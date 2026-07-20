package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.UpsertCourseReviewRequest;
import com.beeacademy.backend.dto.request.ModerateCourseReviewRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseReview;
import com.beeacademy.backend.model.CourseReviewModerationStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseReviewRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseReviewServiceTest {

    @Mock private CourseRepository courseRepository;
    @Mock private CourseReviewRepository courseReviewRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private CourseProgressService courseProgressService;
    @Mock private ReviewContentModerationService reviewContentModerationService;
    @Mock private UserNotificationService userNotificationService;
    @InjectMocks private CourseReviewService service;

    @Test
    void rejectsReviewBeforeStudentCompletesThirtyPercent() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(courseProgressService.calculateLessonProgressForCourses(studentId, List.of(courseId)))
                .thenReturn(Map.of(courseId, 29));

        assertThatThrownBy(() -> service.upsertCourseReview(
                courseId, student(studentId), request("Noi dung nhan xet du dai de hop le.")))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo("COURSE_REVIEW_PROGRESS_NOT_ELIGIBLE"));

        verify(courseReviewRepository, never()).save(any());
        verify(userNotificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void savesOnePublishedReviewAndNotifiesTeacherAtThirtyPercent() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTeacher()).thenReturn(teacher);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(courseProgressService.calculateLessonProgressForCourses(studentId, List.of(courseId)))
                .thenReturn(Map.of(courseId, 30));
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, studentId)).thenReturn(Optional.empty());
        when(reviewContentModerationService.requiresModeration(any())).thenReturn(false);
        when(courseReviewRepository.save(any(CourseReview.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.upsertCourseReview(
                courseId, student(studentId), request("Noi dung nhan xet du dai de hop le."));

        assertThat(response.moderationStatus()).isEqualTo(CourseReviewModerationStatus.PUBLISHED);
        ArgumentCaptor<CourseReview> saved = ArgumentCaptor.forClass(CourseReview.class);
        verify(courseReviewRepository).save(saved.capture());
        assertThat(saved.getValue().getRating()).isEqualTo(5);
        assertThat(saved.getValue().getComment()).isEqualTo("Noi dung nhan xet du dai de hop le.");
        verify(userNotificationService).notify(
                eq(teacherId), eq("course_review_received"), any(), any(),
                eq("/teacher/courses/" + courseId + "/reviews"));
    }

    @Test
    void updatesExistingReviewAndRoutesFlaggedContentToModeration() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTeacher()).thenReturn(teacher);
        CourseReview existing = CourseReview.create(
                course, student, 3, "Noi dung danh gia cu da du hai muoi ky tu.",
                CourseReviewModerationStatus.PUBLISHED);

        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(courseProgressService.calculateLessonProgressForCourses(studentId, List.of(courseId)))
                .thenReturn(Map.of(courseId, 75));
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, studentId))
                .thenReturn(Optional.of(existing));
        when(reviewContentModerationService.requiresModeration(any())).thenReturn(true);
        when(courseReviewRepository.save(any(CourseReview.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.upsertCourseReview(
                courseId, student(studentId), new UpsertCourseReviewRequest(
                        4, "Noi dung moi bi bo loc danh dau can kiem duyet."));

        assertThat(response.id()).isEqualTo(existing.getId());
        assertThat(response.rating()).isEqualTo(4);
        assertThat(response.moderationStatus())
                .isEqualTo(CourseReviewModerationStatus.PENDING_MODERATION);
        verify(userNotificationService).notify(
                eq(teacherId), eq("course_review_pending_moderation"), any(), any(), any());
    }

    @Test
    void adminCanApprovePendingReviewAndStudentIsNotified() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        CourseReview pending = CourseReview.create(
                course, student, 5, "Noi dung danh gia dang cho quan tri vien duyet.",
                CourseReviewModerationStatus.PENDING_MODERATION);
        when(courseReviewRepository.findWithCourseAndStudentById(pending.getId()))
                .thenReturn(Optional.of(pending));
        when(courseReviewRepository.save(any(CourseReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.moderateReview(
                pending.getId(), new AuthenticatedUser(adminId, "admin@example.com", "admin"),
                new ModerateCourseReviewRequest(
                        ModerateCourseReviewRequest.ModerationDecision.APPROVE,
                        "Noi dung phu hop."));

        assertThat(response.moderationStatus()).isEqualTo(CourseReviewModerationStatus.PUBLISHED);
        assertThat(response.moderatedBy()).isEqualTo(adminId);
        verify(userNotificationService).notify(
                eq(studentId), eq("course_review_moderated"), any(), any(),
                eq("/courses/" + courseId));
    }

    @Test
    void adminMustProvideReasonWhenRejectingReview() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Course course = org.mockito.Mockito.mock(Course.class);
        CourseReview pending = CourseReview.create(
                course, student, 2, "Noi dung danh gia dang cho quan tri vien duyet.",
                CourseReviewModerationStatus.PENDING_MODERATION);
        when(courseReviewRepository.findWithCourseAndStudentById(pending.getId()))
                .thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.moderateReview(
                pending.getId(), new AuthenticatedUser(UUID.randomUUID(), "admin@example.com", "admin"),
                new ModerateCourseReviewRequest(
                        ModerateCourseReviewRequest.ModerationDecision.REJECT, " ")))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(ex.getCode())
                                .isEqualTo("COURSE_REVIEW_REJECTION_REASON_REQUIRED"));

        verify(courseReviewRepository, never()).save(any());
    }

    private AuthenticatedUser student(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", "student");
    }

    private UpsertCourseReviewRequest request(String comment) {
        return new UpsertCourseReviewRequest(5, comment);
    }
}
