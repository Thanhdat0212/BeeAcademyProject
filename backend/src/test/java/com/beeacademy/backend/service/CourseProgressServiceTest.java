package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseProgressServiceTest {

    @Mock
    private CourseProgressItemRepository progressRepository;

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private LessonRepository lessonRepository;

    @Mock
    private QuizConfigRepository quizConfigRepository;

    @Mock
    private QuizAttemptRepository quizAttemptRepository;

    @Mock
    private ChapterRepository chapterRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private ExamConfigRepository examConfigRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private CertificateService certificateService;

    @Mock
    private CourseVersionSnapshotService courseVersionSnapshotService;

    @Mock
    private AssignmentSubmissionRepository assignmentSubmissionRepository;

    @Mock
    private StudentVideoProgressRepository studentVideoProgressRepository;

    @InjectMocks
    private CourseProgressService service;

    @Test
    void completeLessonStoresItemAndUpdatesEnrollmentProgress() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());

        when(courseRepository.existsById(courseId)).thenReturn(true);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(lessonRepository.existsByIdAndCourseId(lessonId, courseId)).thenReturn(true);
        when(progressRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                studentId, courseId, lessonId, "lesson")).thenReturn(false);
        when(courseRepository.countProgressItemsByCourseId(courseId)).thenReturn(4L);
        when(progressRepository.countByStudentIdAndCourseId(studentId, courseId)).thenReturn(1L);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.of(enrollment));
        when(progressRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(List.of());

        Instant updateStartedAt = Instant.now();

        var response = service.completeItem(
                courseId,
                student(studentId),
                new CompleteCourseProgressItemRequest(lessonId, "lesson"));

        ArgumentCaptor<com.beeacademy.backend.model.CourseProgressItem> captor =
                ArgumentCaptor.forClass(com.beeacademy.backend.model.CourseProgressItem.class);
        verify(progressRepository).save(captor.capture());
        assertThat(captor.getValue().getStudentId()).isEqualTo(studentId);
        assertThat(captor.getValue().getCourseId()).isEqualTo(courseId);
        assertThat(captor.getValue().getItemId()).isEqualTo(lessonId);
        assertThat(captor.getValue().getItemType()).isEqualTo("lesson");
        assertThat(enrollment.getProgressPct()).isEqualTo(25);
        assertThat(enrollment.getProgressUpdatedAt()).isAfterOrEqualTo(updateStartedAt);
        assertThat(response.progressPct()).isEqualTo(25);
    }

    @Test
    void completeExistingQuizDoesNotInsertDuplicate() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID chapterId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());

        when(courseRepository.existsById(courseId)).thenReturn(true);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(quizConfigRepository.existsByChapterIdAndCourseId(chapterId, courseId)).thenReturn(true);
        when(progressRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                studentId, courseId, chapterId, "quiz")).thenReturn(true);
        when(courseRepository.countProgressItemsByCourseId(courseId)).thenReturn(2L);
        when(progressRepository.countByStudentIdAndCourseId(studentId, courseId)).thenReturn(2L);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.of(enrollment));
        when(progressRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(List.of());

        service.completeItem(
                courseId,
                student(studentId),
                new CompleteCourseProgressItemRequest(chapterId, "quiz"));

        verify(progressRepository, never()).save(any());
        verify(certificateService).tryIssueAfterProgress(studentId, courseId);
        assertThat(enrollment.getProgressPct()).isEqualTo(100);
    }

    @Test
    void completeItemRejectsLessonFromAnotherCourse() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();

        when(courseRepository.existsById(courseId)).thenReturn(true);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(lessonRepository.existsByIdAndCourseId(lessonId, courseId)).thenReturn(false);

        assertThatThrownBy(() -> service.completeItem(
                courseId,
                student(studentId),
                new CompleteCourseProgressItemRequest(lessonId, "lesson")))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("INVALID_PROGRESS_ITEM");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });

        verify(progressRepository, never()).save(any());
    }

    @Test
    void calculateProgressForCoursesUsesCompletedOverTotalItems() {
        UUID studentId = UUID.randomUUID();
        UUID courseA = UUID.randomUUID();
        UUID courseB = UUID.randomUUID();

        when(progressRepository.countCompletedByStudentAndCourseIds(studentId, List.of(courseA, courseB)))
                .thenReturn(List.<Object[]>of(new Object[]{courseA, 2L}));
        when(courseRepository.countProgressItemsByCourseIds(List.of(courseA, courseB)))
                .thenReturn(List.<Object[]>of(new Object[]{courseA, 4L}, new Object[]{courseB, 0L}));

        var progress = service.calculateProgressForCourses(studentId, List.of(courseA, courseB));

        assertThat(progress).containsEntry(courseA, 50);
        assertThat(progress).containsEntry(courseB, 0);
    }

    @Test
    void learningProgressDoesNotMixRequiredExamsFromAnotherCourseVersion() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID enrollmentVersionId = UUID.randomUUID();
        UUID anotherVersionId = UUID.randomUUID();
        Enrollment enrollment = mock(Enrollment.class);
        Course course = mock(Course.class);
        ExamConfig matchingConfig = examConfig(course, enrollmentVersionId, 0);
        ExamConfig otherVersionConfig = examConfig(course, anotherVersionId, 1);
        ExamAttempt matchingAttempt = passedAttempt(matchingConfig, 82.5);
        ExamAttempt otherVersionAttempt = mock(ExamAttempt.class);
        when(otherVersionAttempt.getExamConfig()).thenReturn(otherVersionConfig);

        when(enrollment.getCourseId()).thenReturn(courseId);
        when(enrollment.getCourseVersionId()).thenReturn(enrollmentVersionId);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Khóa học kiểm thử");
        when(course.getSlug()).thenReturn("khoa-hoc-kiem-thu");
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of(enrollment));
        when(orderItemRepository.findPaidCourseIdsByStudent(studentId, "paid")).thenReturn(List.of());
        when(courseRepository.findByIdIn(List.of(courseId))).thenReturn(List.of(course));
        when(progressRepository.countCompletedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(courseRepository.countProgressItemsByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(courseVersionSnapshotService.findMetrics(enrollmentVersionId)).thenReturn(Optional.empty());
        when(examConfigRepository.findByCourseIds(List.of(courseId)))
                .thenReturn(List.of(matchingConfig, otherVersionConfig));
        when(examAttemptRepository.findByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of(otherVersionAttempt, matchingAttempt));
        when(progressRepository.findByStudentIdAndCourseIdIn(studentId, List.of(courseId))).thenReturn(List.of());
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(chapterRepository.findWithLessonsByCourseIdIn(List.of(courseId))).thenReturn(List.of());

        var response = service.getLearningProgress(student(studentId));

        var detail = response.courses().getFirst();
        assertThat(detail.courseVersionId()).isEqualTo(enrollmentVersionId);
        assertThat(detail.requiredExams()).hasSize(4);
        assertThat(detail.requiredExams().get(0).status()).isEqualTo("passed");
        assertThat(detail.requiredExams().get(0).scorePercent()).isEqualTo(82.5);
        assertThat(detail.requiredExams().get(1).status()).isEqualTo("not_configured");
        assertThat(detail.passedRequiredExams()).isEqualTo(1);
        assertThat(detail.allRequiredExamsPassed()).isFalse();
    }

    private ExamConfig examConfig(Course course, UUID courseVersionId, int slotIndex) {
        ExamConfig config = mock(ExamConfig.class);
        when(config.getId()).thenReturn(UUID.randomUUID());
        when(config.getCourse()).thenReturn(course);
        when(config.getCourseVersionId()).thenReturn(courseVersionId);
        when(config.getSlotIndex()).thenReturn(slotIndex);
        return config;
    }

    private ExamAttempt passedAttempt(ExamConfig config, double scorePercent) {
        ExamAttempt attempt = mock(ExamAttempt.class);
        when(attempt.getExamConfig()).thenReturn(config);
        when(attempt.getSubmittedAt()).thenReturn(Instant.parse("2026-07-17T08:00:00Z"));
        when(attempt.getPassed()).thenReturn(true);
        when(attempt.getEffectiveScorePercent()).thenReturn(BigDecimal.valueOf(scorePercent));
        return attempt;
    }

    private AuthenticatedUser student(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", "student");
    }
}
