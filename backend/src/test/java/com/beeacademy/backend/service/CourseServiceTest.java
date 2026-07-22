package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseReviewModerationStatus;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseReviewRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock private CourseRepository courseRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private CourseDocumentRepository documentRepository;
    @Mock private CourseReviewRepository courseReviewRepository;
    @Mock private QuizConfigRepository quizConfigRepository;
    @Mock private SupabaseStorageClient storageClient;
    @Mock private CourseProgressService courseProgressService;
    @Mock private CertificateEligibilityService certificateEligibilityService;
    @Mock private CourseProgressItemRepository courseProgressItemRepository;
    @Mock private StudentVideoProgressRepository studentVideoProgressRepository;
    @Mock private QuizAttemptRepository quizAttemptRepository;
    @Mock private ExamAttemptRepository examAttemptRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    @InjectMocks private CourseService service;

    @ParameterizedTest
    @CsvSource({
            "100, true, true,  completed",
            "100, true, false, in_progress",
            "100, false, false, in_progress",
            "99,  true, true,  in_progress",
            "0,   false, false, not_started"
    })
    void myCourseIsCompletedOnlyAtFullProgressAndAfterPassingAllRequiredExams(
            int progressPct,
            boolean finalExamPassed,
            boolean allRequiredExamsPassed,
            String expectedStatus) {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Course course = mock(Course.class);
        List<UUID> courseIds = List.of(courseId);

        when(course.getId()).thenReturn(courseId);
        when(course.getGrades()).thenReturn(new int[]{8});
        when(enrollmentRepository.findByStudentIdOrderByEnrolledAtDesc(studentId))
                .thenReturn(List.of(enrollment));
        when(courseRepository.findByIdIn(courseIds)).thenReturn(List.of(course));
        when(lessonRepository.countFreePreviewByCourseIds(courseIds)).thenReturn(List.of());
        when(courseReviewRepository.summarizeByCourseIds(
                courseIds, CourseReviewModerationStatus.PUBLISHED)).thenReturn(List.of());
        when(enrollmentRepository.countGroupedByCourseId(courseIds)).thenReturn(List.of());
        when(courseProgressService.calculateLessonProgressForCourses(studentId, courseIds))
                .thenReturn(Map.of(courseId, progressPct));
        when(certificateEligibilityService.evaluate(enrollment))
                .thenReturn(new CertificateEligibilityService.Eligibility(
                        progressPct >= 100,
                        allRequiredExamsPassed,
                        finalExamPassed,
                        null,
                        Set.of()));
        when(courseProgressItemRepository.findLatestCompletedAtByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(studentVideoProgressRepository.findLatestUpdatedAtByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(quizAttemptRepository.findLatestActivityByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(examAttemptRepository.findLatestActivityByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());

        var result = service.getMyCourses(new AuthenticatedUser(
                studentId, "student@example.com", "student"));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().learningStatus()).isEqualTo(expectedStatus);
        assertThat(result.getFirst().finalExamPassed()).isEqualTo(finalExamPassed);
        assertThat(result.getFirst().allRequiredExamsPassed()).isEqualTo(allRequiredExamsPassed);
    }

    @Test
    void myCoursesDeduplicatesDuplicateEnrollmentsForSameCourse() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment latestEnrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Enrollment duplicateEnrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Course course = mock(Course.class);
        List<UUID> courseIds = List.of(courseId);

        when(course.getId()).thenReturn(courseId);
        when(course.getGrades()).thenReturn(new int[]{8});
        when(enrollmentRepository.findByStudentIdOrderByEnrolledAtDesc(studentId))
                .thenReturn(List.of(latestEnrollment, duplicateEnrollment));
        when(courseRepository.findByIdIn(courseIds)).thenReturn(List.of(course));
        when(lessonRepository.countFreePreviewByCourseIds(courseIds)).thenReturn(List.of());
        when(courseReviewRepository.summarizeByCourseIds(
                courseIds, CourseReviewModerationStatus.PUBLISHED)).thenReturn(List.of());
        when(enrollmentRepository.countGroupedByCourseId(courseIds)).thenReturn(List.of());
        when(courseProgressService.calculateLessonProgressForCourses(studentId, courseIds))
                .thenReturn(Map.of(courseId, 0));
        when(certificateEligibilityService.evaluate(latestEnrollment))
                .thenReturn(new CertificateEligibilityService.Eligibility(
                        false,
                        false,
                        false,
                        null,
                        Set.of()));
        when(courseProgressItemRepository.findLatestCompletedAtByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(studentVideoProgressRepository.findLatestUpdatedAtByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(quizAttemptRepository.findLatestActivityByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());
        when(examAttemptRepository.findLatestActivityByStudentAndCourseIds(studentId, courseIds))
                .thenReturn(List.of());

        var result = service.getMyCourses(new AuthenticatedUser(
                studentId, "student@example.com", "student"));

        assertThat(result).hasSize(1);
        verify(certificateEligibilityService).evaluate(latestEnrollment);
        verify(certificateEligibilityService, never()).evaluate(duplicateEnrollment);
    }
}
