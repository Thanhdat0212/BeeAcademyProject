package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamRetakeDecisionRequest;
import com.beeacademy.backend.dto.request.ExamRetakeRequestCreate;
import com.beeacademy.backend.dto.response.ExamRetakeRequestResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.ExamEnrollmentRetakeStatus;
import com.beeacademy.backend.model.ExamRetakeRequest;
import com.beeacademy.backend.model.ExamRetakeStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamRetakeRequestRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExamRetakeServiceTest {

    @Mock private ExamRetakeRequestRepository retakeRepository;
    @Mock private ExamConfigVersionService examConfigVersionService;
    @Mock private ExamAttemptRepository examAttemptRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private UserNotificationService userNotificationService;
    @Mock private JdbcTemplate jdbcTemplate;

    @InjectMocks private ExamRetakeService service;

    @Test
    void accessStatusCoversAvailableLockedAndApprovedStates() {
        UUID studentId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        ExamConfig config = mock(ExamConfig.class);
        when(config.getId()).thenReturn(examId);
        when(config.getMaxAttempts()).thenReturn(2);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                studentId, examId, ExamRetakeStatus.APPROVED))
                .thenReturn(List.of());
        when(examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                studentId, examId)).thenReturn(Optional.empty());
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                studentId, examId)).thenReturn(0, 3);

        assertThat(service.accessStatus(studentId, config))
                .isEqualTo(ExamEnrollmentRetakeStatus.AVAILABLE);
        assertThat(service.accessStatus(studentId, config))
                .isEqualTo(ExamEnrollmentRetakeStatus.RETAKE_LOCKED);

        ExamRetakeRequest approval = mock(ExamRetakeRequest.class);
        when(approval.getRetakeExpireAt()).thenReturn(Instant.now().plus(1, ChronoUnit.DAYS));
        when(approval.getExtraAttempts()).thenReturn(1);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                studentId, examId, ExamRetakeStatus.APPROVED))
                .thenReturn(List.of(approval));
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                studentId, examId)).thenReturn(3);

        assertThat(service.accessStatus(studentId, config))
                .isEqualTo(ExamEnrollmentRetakeStatus.RETAKE_APPROVED);
    }

    @Test
    void accessIsLockedAfterFourteenDaysWithoutActiveApproval() {
        UUID studentId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        ExamConfig config = mock(ExamConfig.class);
        ExamAttempt firstAttempt = mock(ExamAttempt.class);
        when(config.getId()).thenReturn(examId);
        when(config.getMaxAttempts()).thenReturn(2);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                studentId, examId, ExamRetakeStatus.APPROVED))
                .thenReturn(List.of());
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                studentId, examId)).thenReturn(1);
        when(examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                studentId, examId)).thenReturn(Optional.of(firstAttempt));
        when(firstAttempt.getSubmittedAt()).thenReturn(Instant.now().minus(15, ChronoUnit.DAYS));

        assertThat(service.accessStatus(studentId, config))
                .isEqualTo(ExamEnrollmentRetakeStatus.RETAKE_LOCKED);
    }

    @Test
    void requestIsRejectedDuringTwelveHourCooldown() {
        RetakeFixture fixture = fixture();
        ExamRetakeRequest rejected = mock(ExamRetakeRequest.class);
        when(rejected.getStatus()).thenReturn(ExamRetakeStatus.REJECTED);
        when(rejected.getCooldownUntil()).thenReturn(Instant.now().plus(12, ChronoUnit.HOURS));
        when(retakeRepository.findFirstByStudentIdAndExamConfigIdOrderByCreatedAtDesc(
                fixture.studentId(), fixture.examId())).thenReturn(Optional.of(rejected));

        assertThatThrownBy(() -> service.requestRetake(
                fixture.courseId(), 0, fixture.studentUser(),
                new ExamRetakeRequestCreate("Tôi cần thêm lượt để cải thiện kết quả")))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("RETAKE_REQUEST_COOLDOWN"));
        verify(retakeRepository, never()).save(any());
    }

    @Test
    void fourthRequestIsRejectedByRequestLimit() {
        RetakeFixture fixture = fixture();
        when(retakeRepository.countByStudentIdAndExamConfigId(
                fixture.studentId(), fixture.examId())).thenReturn(3L);

        assertThatThrownBy(() -> service.requestRetake(
                fixture.courseId(), 0, fixture.studentUser(),
                new ExamRetakeRequestCreate("Tôi cần thêm lượt để cải thiện kết quả")))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("RETAKE_REQUEST_LIMIT"));
        verify(retakeRepository, never()).save(any());
    }

    @Test
    void requestBeforeExamIsLockedIsRejected() {
        RetakeFixture fixture = fixture();
        when(retakeRepository.countByStudentIdAndExamConfigId(
                fixture.studentId(), fixture.examId())).thenReturn(0L);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                fixture.studentId(), fixture.examId(), ExamRetakeStatus.APPROVED))
                .thenReturn(List.of());
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                fixture.studentId(), fixture.examId())).thenReturn(0);
        when(examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                fixture.studentId(), fixture.examId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requestRetake(
                fixture.courseId(), 0, fixture.studentUser(),
                new ExamRetakeRequestCreate("Tôi cần thêm lượt để cải thiện kết quả")))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("RETAKE_NOT_LOCKED"));
        verify(retakeRepository, never()).save(any());
    }

    @Test
    void thirdRequestIsAcceptedOnlyWhenExamIsLocked() {
        RetakeFixture fixture = fixture();
        when(retakeRepository.countByStudentIdAndExamConfigId(
                fixture.studentId(), fixture.examId())).thenReturn(2L);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                fixture.studentId(), fixture.examId(), ExamRetakeStatus.APPROVED))
                .thenReturn(List.of());
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                fixture.studentId(), fixture.examId())).thenReturn(3);
        when(examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                fixture.studentId(), fixture.examId())).thenReturn(Optional.empty());
        when(profileRepository.findById(fixture.studentId())).thenReturn(Optional.of(fixture.student()));
        when(retakeRepository.save(any(ExamRetakeRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExamRetakeRequestResponse response = service.requestRetake(
                fixture.courseId(), 0, fixture.studentUser(),
                new ExamRetakeRequestCreate("Tôi cần thêm lượt để cải thiện kết quả"));

        assertThat(response.requestCount()).isEqualTo(3);
        assertThat(response.examEnrollmentStatus()).isEqualTo("RETAKE_LOCKED");
    }

    @Test
    void rejectionPersistsCooldownForApproximatelyTwelveHours() {
        RetakeFixture fixture = fixture();
        ExamRetakeRequest pending = ExamRetakeRequest.create(
                fixture.student(), fixture.config(), "Xin thêm lượt làm bài", 1, 0);
        when(retakeRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(retakeRepository.save(pending)).thenReturn(pending);
        when(retakeRepository.findByStudentIdAndExamConfigIdAndStatus(
                fixture.studentId(), fixture.examId(), ExamRetakeStatus.APPROVED))
                .thenReturn(List.of());
        when(examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                fixture.studentId(), fixture.examId())).thenReturn(3);
        when(examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                fixture.studentId(), fixture.examId())).thenReturn(Optional.empty());

        Instant before = Instant.now().plus(11, ChronoUnit.HOURS).plus(59, ChronoUnit.MINUTES);
        ExamRetakeRequestResponse response = service.decide(
                pending.getId(),
                new AuthenticatedUser(UUID.randomUUID(), "admin@example.com", "admin"),
                new ExamRetakeDecisionRequest(false, null, "Chưa đủ căn cứ để mở thêm lượt"));
        Instant after = Instant.now().plus(12, ChronoUnit.HOURS).plus(1, ChronoUnit.MINUTES);

        assertThat(response.status()).isEqualTo("REJECTED");
        assertThat(response.examEnrollmentStatus()).isEqualTo("RETAKE_LOCKED");
        assertThat(response.cooldownUntil()).isBetween(before, after);
    }

    private RetakeFixture fixture() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        ExamConfig config = mock(ExamConfig.class);
        Course course = mock(Course.class);
        Profile student = mock(Profile.class);
        when(config.getId()).thenReturn(examId);
        when(config.getMaxAttempts()).thenReturn(1);
        when(config.getCourse()).thenReturn(course);
        when(config.getSlotIndex()).thenReturn(0);
        when(config.getName()).thenReturn("Giữa kỳ 1");
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Khóa học kiểm thử");
        when(student.getId()).thenReturn(studentId);
        when(student.getFullName()).thenReturn("Học sinh kiểm thử");
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(examConfigVersionService.forEnrollment(enrollment, 0)).thenReturn(Optional.of(config));
        when(retakeRepository.existsByStudentIdAndExamConfigIdAndStatus(
                studentId, examId, ExamRetakeStatus.PENDING)).thenReturn(false);
        when(retakeRepository.findFirstByStudentIdAndExamConfigIdOrderByCreatedAtDesc(studentId, examId))
                .thenReturn(Optional.empty());
        return new RetakeFixture(
                studentId,
                courseId,
                examId,
                enrollment,
                config,
                course,
                student,
                new AuthenticatedUser(studentId, "student@example.com", "student"));
    }

    private record RetakeFixture(
            UUID studentId,
            UUID courseId,
            UUID examId,
            Enrollment enrollment,
            ExamConfig config,
            Course course,
            Profile student,
            AuthenticatedUser studentUser) {
    }
}
