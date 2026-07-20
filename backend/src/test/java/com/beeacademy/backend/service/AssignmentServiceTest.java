package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.GradeAssignmentSubmissionRequest;
import com.beeacademy.backend.dto.request.SubmitAssignmentRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AssignmentRepository;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.GradeAuditLogRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentServiceTest {

    @Mock private AssignmentRepository assignmentRepository;
    @Mock private AssignmentSubmissionRepository submissionRepository;
    @Mock private ChapterRepository chapterRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private GradeAuditLogRepository gradeAuditLogRepository;
    @Mock private UserNotificationService userNotificationService;
    @Mock private TeacherAccessService teacherAccessService;
    @Mock private CourseProgressService courseProgressService;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks private AssignmentService service;

    @Test
    void firstOnTimeSubmissionUsesAttemptOneAndKeepsTwoAttempts() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().plusSeconds(3600), false, 0, true, 3);
        stubStudentCanAccess(studentId, assignmentId, assignment);
        when(submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId))
                .thenReturn(Optional.empty());
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student(studentId)));
        when(submissionRepository.save(any(AssignmentSubmission.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.submitAssignment(
                assignmentId,
                studentUser(studentId),
                new SubmitAssignmentRequest("Bài làm", List.of()));

        assertThat(response.mySubmission()).isNotNull();
        assertThat(response.mySubmission().attemptNumber()).isEqualTo(1);
        assertThat(response.mySubmission().late()).isFalse();
        assertThat(response.remainingAttempts()).isEqualTo(2);
        assertThat(response.canSubmit()).isTrue();
    }

    @Test
    void overdueSubmissionIsRejectedWhenLateSubmissionIsDisabled() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().minusSeconds(60), false, 0, true, 3);
        stubStudentCanAccess(studentId, assignmentId, assignment);
        when(submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId))
                .thenReturn(Optional.empty());

        assertBusinessCode(
                () -> service.submitAssignment(
                        assignmentId,
                        studentUser(studentId),
                        new SubmitAssignmentRequest("Bài làm", List.of())),
                "ASSIGNMENT_OVERDUE");
    }

    @Test
    void studentListExposesOverdueStateAndDisablesSubmission() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(
                assignmentId, Instant.now().minusSeconds(60), false, 0, true, 3);
        UUID courseId = assignment.getCourse().getId();
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(true);
        when(assignmentRepository.findAllByCourseId(courseId))
                .thenReturn(List.of(assignment));
        when(submissionRepository.findByAssignmentIdInAndStudentId(
                List.of(assignmentId), studentId)).thenReturn(List.of());

        var response = service.listStudentAssignments(courseId, studentUser(studentId));

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().submissionAvailability()).isEqualTo("overdue");
        assertThat(response.getFirst().canSubmit()).isFalse();
        assertThat(response.getFirst().remainingAttempts()).isEqualTo(3);
    }

    @Test
    void allowedLateSubmissionStoresLateFlagAndConfiguredPenalty() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().minusSeconds(60), true, 20, true, 3);
        stubStudentCanAccess(studentId, assignmentId, assignment);
        when(submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId))
                .thenReturn(Optional.empty());
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student(studentId)));
        when(submissionRepository.save(any(AssignmentSubmission.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.submitAssignment(
                assignmentId,
                studentUser(studentId),
                new SubmitAssignmentRequest("Bài làm muộn", List.of()));

        assertThat(response.mySubmission().late()).isTrue();
        assertThat(response.mySubmission().appliedLatePenaltyPercent()).isEqualTo(20);
        assertThat(response.submissionAvailability()).isEqualTo("late_allowed");
    }

    @Test
    void fourthSubmissionIsRejectedAtDefaultThreeAttemptLimit() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().plusSeconds(3600), false, 0, true, 3);
        Profile student = student(studentId);
        AssignmentSubmission existing = AssignmentSubmission.submit(
                assignment, student, "Lần 1", "[]");
        existing.resubmit("Lần 2", "[]");
        existing.resubmit("Lần 3", "[]");
        stubStudentCanAccess(studentId, assignmentId, assignment);
        when(submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId))
                .thenReturn(Optional.of(existing));

        assertBusinessCode(
                () -> service.submitAssignment(
                        assignmentId,
                        studentUser(studentId),
                        new SubmitAssignmentRequest("Lần 4", List.of())),
                "ASSIGNMENT_ATTEMPT_LIMIT_REACHED");
        assertThat(existing.effectiveAttemptNumber()).isEqualTo(3);
    }

    @Test
    void closedAssignmentRejectsNewSubmission() {
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().plusSeconds(3600), false, 0, false, 3);
        stubStudentCanAccess(studentId, assignmentId, assignment);
        when(submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId))
                .thenReturn(Optional.empty());

        assertBusinessCode(
                () -> service.submitAssignment(
                        assignmentId,
                        studentUser(studentId),
                        new SubmitAssignmentRequest("Bài làm", List.of())),
                "ASSIGNMENT_CLOSED");
    }

    @Test
    void gradingLateSubmissionAppliesStoredPercentagePenalty() {
        UUID teacherId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID submissionId = UUID.randomUUID();
        Assignment assignment = assignment(assignmentId, Instant.now().minusSeconds(60), true, 20, true, 3);
        AssignmentSubmission submission = AssignmentSubmission.submit(
                assignment, student(studentId), "Bài làm", "[]", true, 20);
        org.springframework.test.util.ReflectionTestUtils.setField(submission, "id", submissionId);
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher");

        when(submissionRepository.findOwned(submissionId, teacherId))
                .thenReturn(Optional.of(submission));
        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(submissionRepository.save(submission)).thenReturn(submission);
        when(gradeAuditLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.gradeSubmission(
                submissionId,
                new AuthenticatedUser(teacherId, "teacher@example.com", "teacher"),
                new GradeAssignmentSubmissionRequest(10.0, "Tốt"));

        assertThat(response.rawScore()).isEqualTo(10.0);
        assertThat(response.appliedLatePenaltyPercent()).isEqualTo(20);
        assertThat(response.score()).isEqualTo(8.0);
        verify(userNotificationService).notify(
                eq(studentId),
                eq("assignment_graded"),
                eq("Bai tap da duoc cham diem"),
                anyString(),
                eq("/student/courses"));
    }

    private Assignment assignment(
            UUID assignmentId,
            Instant dueAt,
            boolean allowLate,
            int penaltyPercent,
            boolean accepting,
            int maxAttempts) {
        Assignment assignment = mock(Assignment.class);
        Course course = mock(Course.class);
        lenient().when(assignment.getId()).thenReturn(assignmentId);
        lenient().when(assignment.getCourse()).thenReturn(course);
        lenient().when(assignment.getDueAt()).thenReturn(dueAt);
        lenient().when(assignment.permitsLateSubmission()).thenReturn(allowLate);
        lenient().when(assignment.effectiveLatePenaltyPercent()).thenReturn(penaltyPercent);
        lenient().when(assignment.isAcceptingSubmissions()).thenReturn(accepting);
        lenient().when(assignment.effectiveMaxAttempts()).thenReturn(maxAttempts);
        lenient().when(assignment.getMaxScore()).thenReturn(10);
        lenient().when(course.getId()).thenReturn(UUID.randomUUID());
        return assignment;
    }

    private void stubStudentCanAccess(UUID studentId, UUID assignmentId, Assignment assignment) {
        when(assignmentRepository.findWithCourseById(assignmentId))
                .thenReturn(Optional.of(assignment));
        when(enrollmentRepository.existsByStudentIdAndCourseId(
                studentId, assignment.getCourse().getId())).thenReturn(true);
    }

    private Profile student(UUID studentId) {
        return Profile.createNew(studentId, UserRole.STUDENT, "Student");
    }

    private AuthenticatedUser studentUser(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", "student");
    }

    private void assertBusinessCode(Runnable action, String expectedCode) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(((BusinessException) exception).getCode())
                                .isEqualTo(expectedCode));
    }
}
