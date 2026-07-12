package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private CertificateService certificateService;

    @InjectMocks
    private CourseProgressService service;

    @Test
    void completeLessonStoresItemAndUpdatesEnrollmentProgress() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId);

        when(courseRepository.existsById(courseId)).thenReturn(true);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(lessonRepository.existsByIdAndCourseId(lessonId, courseId)).thenReturn(true);
        when(progressRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                studentId, courseId, lessonId, "lesson")).thenReturn(false);
        when(courseRepository.countProgressItemsByCourseId(courseId)).thenReturn(4L);
        when(progressRepository.countByStudentIdAndCourseId(studentId, courseId)).thenReturn(1L);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(Optional.of(enrollment));
        when(progressRepository.findByStudentIdAndCourseId(studentId, courseId)).thenReturn(List.of());

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
        assertThat(response.progressPct()).isEqualTo(25);
    }

    @Test
    void completeExistingQuizDoesNotInsertDuplicate() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID chapterId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId);

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

    private AuthenticatedUser student(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", "student");
    }
}
