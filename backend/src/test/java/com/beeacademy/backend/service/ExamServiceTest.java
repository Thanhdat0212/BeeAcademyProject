package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamConfigRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamServiceTest {

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private ExamConfigVersionService examConfigVersionService;

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private ChapterRepository chapterRepository;

    @Mock
    private ExamConfigRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private TeacherAccessService teacherAccessService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ExamService service;

    @Test
    void saveExamRejectsUnderTenQuestionsWithoutTeacherConfirmation() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        givenOwnedCourse(courseId, teacherId);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(mock(Profile.class)));

        assertThatThrownBy(() -> service.saveExam(
                courseId,
                0,
                teacher(teacherId),
                request(false, List.of(aiEssayQuestion(null)))))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("EXAM_UNDER_MIN_QUESTIONS"));

        verify(examRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void saveExamRejectsEssayQuestionWithoutRubricAfterUnderTenConfirmed() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        givenOwnedCourse(courseId, teacherId);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(mock(Profile.class)));

        assertThatThrownBy(() -> service.saveExam(
                courseId,
                0,
                teacher(teacherId),
                request(true, List.of(aiEssayQuestion(null)))))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("ESSAY_RUBRIC_REQUIRED"));

        verify(examRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void saveExamRejectsAiQuestionBeforeTeacherApproval() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        givenOwnedCourse(courseId, teacherId);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(mock(Profile.class)));

        assertThatThrownBy(() -> service.saveExam(
                courseId,
                0,
                teacher(teacherId),
                request(true, List.of(aiEssayQuestion("Rubric", "draft")))))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("AI_QUESTION_NOT_APPROVED"));

        verify(examRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void saveExamAllowsTeacherDefinedQuestionsWithoutQuestionBankLookup() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID scopeChapterId = UUID.randomUUID();
        UUID placementChapterId = UUID.randomUUID();
        UUID thirdChapterId = UUID.randomUUID();
        UUID lastChapterId = UUID.randomUUID();
        Course course = givenOwnedCourse(courseId, teacherId);
        when(course.getId()).thenReturn(courseId);
        Profile teacherProfile = mock(Profile.class);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(teacherProfile));

        Chapter scopeChapter = chapter(course, scopeChapterId, "Chapter 1");
        Chapter placementChapter = chapter(course, placementChapterId, "Chapter 2");
        Chapter thirdChapter = chapter(course, thirdChapterId, "Chapter 3");
        Chapter lastChapter = chapter(course, lastChapterId, "Chapter 4");
        when(chapterRepository.findById(scopeChapterId)).thenReturn(Optional.of(scopeChapter));
        when(chapterRepository.findById(placementChapterId)).thenReturn(Optional.of(placementChapter));
        when(chapterRepository.findWithLessonsByCourseId(courseId))
                .thenReturn(List.of(scopeChapter, placementChapter, thirdChapter, lastChapter));
        when(chapterRepository.findByCourseIdOrderByPositionAsc(courseId))
                .thenReturn(List.of(scopeChapter, placementChapter, thirdChapter, lastChapter));
        when(examConfigVersionService.currentForAuthoring(courseId)).thenReturn(List.of());
        when(examConfigVersionService.ensureDraftSet(courseId)).thenReturn(List.of());
        when(examRepository.save(any(ExamConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.saveExam(
                courseId,
                0,
                teacher(teacherId),
                request(true, scopeChapterId, placementChapterId, List.of(
                        directMultipleChoiceQuestion(),
                        directEssayQuestion())));

        verify(questionRepository, never()).findById(any(UUID.class));
    }

    @Test
    void saveFinalExamAllowsOverlappingPreviousSlotWhenCoverageHasNoGap() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Course course = givenOwnedCourse(courseId, teacherId);
        when(course.getId()).thenReturn(courseId);
        Profile teacherProfile = mock(Profile.class);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(teacherProfile));

        Chapter chapter1 = chapter(course, UUID.randomUUID(), "Chapter 1");
        Chapter chapter2 = chapter(course, UUID.randomUUID(), "Chapter 2");
        Chapter chapter3 = chapter(course, UUID.randomUUID(), "Chapter 3");
        Chapter chapter4 = chapter(course, UUID.randomUUID(), "Chapter 4");
        Chapter chapter5 = chapter(course, UUID.randomUUID(), "Chapter 5");
        Chapter chapter6 = chapter(course, UUID.randomUUID(), "Chapter 6");
        Chapter chapter7 = chapter(course, UUID.randomUUID(), "Chapter 7");
        List<Chapter> chapters = List.of(chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7);

        when(chapterRepository.findById(chapter4.getId())).thenReturn(Optional.of(chapter4));
        when(chapterRepository.findById(chapter7.getId())).thenReturn(Optional.of(chapter7));
        when(chapterRepository.findWithLessonsByCourseId(courseId)).thenReturn(chapters);
        when(chapterRepository.findByCourseIdOrderByPositionAsc(courseId)).thenReturn(chapters);
        List<ExamConfig> existingExams = List.of(
                existingExam(0, chapter1, chapter2),
                existingExam(1, chapter3, chapter3),
                existingExam(2, chapter4, chapter4));
        when(examConfigVersionService.currentForAuthoring(courseId)).thenReturn(existingExams);
        when(examConfigVersionService.ensureDraftSet(courseId)).thenReturn(existingExams);
        when(examRepository.save(any(ExamConfig.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.saveExam(
                courseId,
                3,
                teacher(teacherId),
                request(true, chapter4.getId(), chapter7.getId(), List.of(
                        directMultipleChoiceQuestion(),
                        directEssayQuestion())));

        verify(examRepository).save(any(ExamConfig.class));
    }

    @Test
    void saveExamRejectsGapBetweenFixedExamSlots() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Course course = givenOwnedCourse(courseId, teacherId);
        when(course.getId()).thenReturn(courseId);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(mock(Profile.class)));

        Chapter chapter1 = chapter(course, UUID.randomUUID(), "Chapter 1");
        Chapter chapter2 = chapter(course, UUID.randomUUID(), "Chapter 2");
        Chapter chapter3 = chapter(course, UUID.randomUUID(), "Chapter 3");
        Chapter chapter4 = chapter(course, UUID.randomUUID(), "Chapter 4");
        List<Chapter> chapters = List.of(chapter1, chapter2, chapter3, chapter4);

        when(chapterRepository.findById(chapter3.getId())).thenReturn(Optional.of(chapter3));
        when(chapterRepository.findWithLessonsByCourseId(courseId)).thenReturn(chapters);
        when(chapterRepository.findByCourseIdOrderByPositionAsc(courseId)).thenReturn(chapters);
        ExamConfig firstExam = existingExam(0, chapter1, chapter1);
        when(examConfigVersionService.currentForAuthoring(courseId))
                .thenReturn(List.of(firstExam));

        assertThatThrownBy(() -> service.saveExam(
                courseId,
                1,
                teacher(teacherId),
                request(true, chapter3.getId(), chapter3.getId(), List.of(
                        directMultipleChoiceQuestion(),
                        directEssayQuestion()))))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("INVALID_EXAM_SCOPE_COVERAGE"));

        verify(examRepository, never()).save(any(ExamConfig.class));
    }

    @Test
    void saveFinalExamRejectsWhenItDoesNotEndAtLastChapter() {
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Course course = givenOwnedCourse(courseId, teacherId);
        when(course.getId()).thenReturn(courseId);
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(mock(Profile.class)));

        Chapter chapter1 = chapter(course, UUID.randomUUID(), "Chapter 1");
        Chapter chapter2 = chapter(course, UUID.randomUUID(), "Chapter 2");
        Chapter chapter3 = chapter(course, UUID.randomUUID(), "Chapter 3");
        Chapter chapter4 = chapter(course, UUID.randomUUID(), "Chapter 4");
        Chapter chapter5 = chapter(course, UUID.randomUUID(), "Chapter 5");
        List<Chapter> chapters = List.of(chapter1, chapter2, chapter3, chapter4, chapter5);

        when(chapterRepository.findById(chapter4.getId())).thenReturn(Optional.of(chapter4));
        when(chapterRepository.findWithLessonsByCourseId(courseId)).thenReturn(chapters);
        when(chapterRepository.findByCourseIdOrderByPositionAsc(courseId)).thenReturn(chapters);
        ExamConfig firstExam = existingExam(0, chapter1, chapter1);
        ExamConfig secondExam = existingExam(1, chapter2, chapter2);
        ExamConfig thirdExam = existingExam(2, chapter3, chapter3);
        when(examConfigVersionService.currentForAuthoring(courseId))
                .thenReturn(List.of(firstExam, secondExam, thirdExam));

        assertThatThrownBy(() -> service.saveExam(
                courseId,
                3,
                teacher(teacherId),
                request(true, chapter4.getId(), chapter4.getId(), List.of(
                        directMultipleChoiceQuestion(),
                        directEssayQuestion()))))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("INVALID_EXAM_SCOPE_COVERAGE"));

        verify(examRepository, never()).save(any(ExamConfig.class));
    }

    private Course givenOwnedCourse(UUID courseId, UUID teacherId) {
        Profile teacherProfile = mock(Profile.class);
        when(teacherProfile.getId()).thenReturn(teacherId);
        Course course = mock(Course.class);
        when(course.getTeacher()).thenReturn(teacherProfile);
        when(courseRepository.findWithCategoryAndTeacherById(courseId)).thenReturn(Optional.of(course));
        lenient().when(examConfigVersionService.currentForAuthoring(courseId))
                .thenReturn(List.of());
        lenient().when(examConfigVersionService.ensureDraftSet(courseId))
                .thenReturn(List.of());
        lenient().when(teacherAccessService.requireApprovedTeacher(any(AuthenticatedUser.class)))
                .thenReturn(teacherProfile);
        return course;
    }

    private ExamConfigRequest request(
            boolean confirmUnderTen,
            List<ExamConfigRequest.ExamQuestionRequest> questions) {
        return request(confirmUnderTen, UUID.randomUUID(), UUID.randomUUID(), questions);
    }

    private ExamConfigRequest request(
            boolean confirmUnderTen,
            UUID scopeStartChapterId,
            UUID placementChapterId,
            List<ExamConfigRequest.ExamQuestionRequest> questions) {
        return new ExamConfigRequest(
                "Midterm",
                scopeStartChapterId,
                placementChapterId,
                "chapter_test",
                null,
                45,
                60,
                1,
                true,
                true,
                false,
                false,
                false,
                confirmUnderTen,
                questions);
    }

    private Chapter chapter(Course course, UUID id, String title) {
        Chapter chapter = mock(Chapter.class);
        lenient().when(chapter.getId()).thenReturn(id);
        lenient().when(chapter.getCourse()).thenReturn(course);
        lenient().when(chapter.getTitle()).thenReturn(title);
        lenient().when(chapter.getLessons()).thenReturn(List.of(mock(Lesson.class)));
        return chapter;
    }

    private ExamConfig existingExam(int slotIndex, Chapter scopeStartChapter, Chapter placementChapter) {
        ExamConfig exam = mock(ExamConfig.class);
        lenient().when(exam.getSlotIndex()).thenReturn(slotIndex);
        lenient().when(exam.getScopeStartChapter()).thenReturn(scopeStartChapter);
        lenient().when(exam.getPlacementChapter()).thenReturn(placementChapter);
        return exam;
    }

    private ExamConfigRequest.ExamQuestionRequest directMultipleChoiceQuestion() {
        var mapper = new ObjectMapper();
        var metadata = mapper.createObjectNode();
        metadata.put("sourceType", "direct_exam");
        metadata.put("createdInExam", true);
        return new ExamConfigRequest.ExamQuestionRequest(
                "manual-" + UUID.randomUUID(),
                null,
                "2 + 2 = ?",
                "multiple_choice",
                List.of("3", "4", "5", "6"),
                List.of(1),
                metadata,
                "4 is the correct answer.",
                6.0,
                "medium");
    }

    private ExamConfigRequest.ExamQuestionRequest directEssayQuestion() {
        var mapper = new ObjectMapper();
        var metadata = mapper.createObjectNode();
        metadata.put("sourceType", "direct_exam");
        metadata.put("createdInExam", true);
        return new ExamConfigRequest.ExamQuestionRequest(
                "manual-" + UUID.randomUUID(),
                null,
                "Explain your reasoning.",
                "essay",
                List.of(),
                List.of(),
                metadata,
                "Rubric: clear reasoning and final answer.",
                4.0,
                "medium");
    }

    private ExamConfigRequest.ExamQuestionRequest aiEssayQuestion(String rubric) {
        var mapper = new ObjectMapper();
        var metadata = mapper.createObjectNode();
        metadata.put("aiPromptId", UUID.randomUUID().toString());
        metadata.putArray("sourceRefs").add("teacher_prompt");
        metadata.put("aiStatus", "approved");
        if (rubric != null) {
            metadata.put("rubric", rubric);
        }
        return new ExamConfigRequest.ExamQuestionRequest(
                "ai-" + UUID.randomUUID(),
                null,
                "Explain the solution.",
                "essay",
                List.of(),
                List.of(),
                metadata,
                null,
                10.0,
                "medium");
    }

    private ExamConfigRequest.ExamQuestionRequest aiEssayQuestion(String rubric, String aiStatus) {
        var mapper = new ObjectMapper();
        var metadata = mapper.createObjectNode();
        metadata.put("aiPromptId", UUID.randomUUID().toString());
        metadata.put("aiStatus", aiStatus);
        metadata.putArray("sourceRefs").add("teacher_prompt");
        if (rubric != null) {
            metadata.put("rubric", rubric);
        }
        return new ExamConfigRequest.ExamQuestionRequest(
                "ai-" + UUID.randomUUID(),
                null,
                "Explain the solution.",
                "essay",
                List.of(),
                List.of(),
                metadata,
                null,
                10.0,
                "medium");
    }

    private AuthenticatedUser teacher(UUID teacherId) {
        return new AuthenticatedUser(teacherId, "teacher@example.com", "teacher");
    }
}
