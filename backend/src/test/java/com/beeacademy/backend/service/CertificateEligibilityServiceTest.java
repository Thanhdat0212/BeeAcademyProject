package com.beeacademy.backend.service;

import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CertificateEligibilityServiceTest {

    @Mock ExamConfigVersionService examConfigVersionService;
    @Mock ExamAttemptRepository examAttemptRepository;
    @Mock CourseProgressItemRepository progressItemRepository;
    @Mock CourseRepository courseRepository;
    @Mock CourseVersionSnapshotService courseVersionSnapshotService;

    @InjectMocks CertificateEligibilityService service;

    @Test
    void eligibleWhenProgressIsCompleteAndAllFourRequiredExamsPassed() {
        Fixture fixture = fixture();
        when(examAttemptRepository.findPassedRequiredExamConfigIds(
                fixture.studentId, fixture.examIds)).thenReturn(List.copyOf(fixture.examIds));
        when(examAttemptRepository.findPassedAttemptsForConfig(
                fixture.studentId, fixture.finalExamId)).thenReturn(List.of(fixture.finalAttempt));
        when(progressItemRepository.countByStudentIdAndCourseId(
                fixture.studentId, fixture.courseId)).thenReturn(4L);

        var result = service.evaluate(fixture.enrollment);

        assertThat(result.eligible()).isTrue();
        assertThat(result.allRequiredExamsPassed()).isTrue();
        assertThat(result.finalExamPassed()).isTrue();
        assertThat(result.requiredExamConfigIds()).isEqualTo(fixture.examIds);
    }

    @Test
    void finalExamAloneDoesNotMakeCertificateEligible() {
        Fixture fixture = fixture();
        when(examAttemptRepository.findPassedRequiredExamConfigIds(
                fixture.studentId, fixture.examIds)).thenReturn(List.of(fixture.finalExamId));
        when(examAttemptRepository.findPassedAttemptsForConfig(
                fixture.studentId, fixture.finalExamId)).thenReturn(List.of(fixture.finalAttempt));
        when(progressItemRepository.countByStudentIdAndCourseId(
                fixture.studentId, fixture.courseId)).thenReturn(4L);

        var result = service.evaluate(fixture.enrollment);

        assertThat(result.finalExamPassed()).isTrue();
        assertThat(result.allRequiredExamsPassed()).isFalse();
        assertThat(result.eligible()).isFalse();
    }

    @Test
    void passingOtherThreeExamsWithoutFinalKeepsCertificateIneligible() {
        Fixture fixture = fixture();
        List<UUID> onlyThreePassed = fixture.examIds.stream()
                .filter(id -> !id.equals(fixture.finalExamId))
                .toList();
        when(examAttemptRepository.findPassedRequiredExamConfigIds(
                fixture.studentId, fixture.examIds)).thenReturn(onlyThreePassed);
        when(examAttemptRepository.findPassedAttemptsForConfig(
                fixture.studentId, fixture.finalExamId)).thenReturn(List.of());
        when(progressItemRepository.countByStudentIdAndCourseId(
                fixture.studentId, fixture.courseId)).thenReturn(4L);

        var result = service.evaluate(fixture.enrollment);

        assertThat(result.eligible()).isFalse();
        assertThat(result.allRequiredExamsPassed()).isFalse();
    }

    @Test
    void incompleteProgressKeepsCertificateIneligibleAfterPassingAllRequiredExams() {
        Fixture fixture = fixture();
        when(examAttemptRepository.findPassedRequiredExamConfigIds(
                fixture.studentId, fixture.examIds)).thenReturn(List.copyOf(fixture.examIds));
        when(examAttemptRepository.findPassedAttemptsForConfig(
                fixture.studentId, fixture.finalExamId)).thenReturn(List.of(fixture.finalAttempt));
        when(progressItemRepository.countByStudentIdAndCourseId(
                fixture.studentId, fixture.courseId)).thenReturn(3L);

        assertThat(service.evaluate(fixture.enrollment).eligible()).isFalse();
    }

    private Fixture fixture() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, versionId);

        List<ExamConfig> configs = java.util.stream.IntStream.range(0, 4)
                .mapToObj(slot -> {
                    ExamConfig config = mock(ExamConfig.class);
                    when(config.getId()).thenReturn(UUID.randomUUID());
                    when(config.getSlotIndex()).thenReturn(slot);
                    return config;
                })
                .toList();
        Set<UUID> examIds = configs.stream().map(ExamConfig::getId).collect(java.util.stream.Collectors.toSet());
        UUID finalExamId = configs.get(3).getId();
        ExamAttempt finalAttempt = mock(ExamAttempt.class);

        when(examConfigVersionService.forEnrollment(enrollment)).thenReturn(configs);
        when(courseRepository.countProgressItemsByCourseId(courseId)).thenReturn(4L);
        when(courseVersionSnapshotService.findMetrics(versionId)).thenReturn(Optional.of(
                new CourseVersionSnapshotService.SnapshotMetrics(
                        versionId,
                        1,
                        Set.of(),
                        examIds,
                        Set.of(),
                        true,
                        examIds)));
        return new Fixture(
                studentId, courseId, enrollment, examIds, finalExamId, finalAttempt);
    }

    private record Fixture(
            UUID studentId,
            UUID courseId,
            Enrollment enrollment,
            Set<UUID> examIds,
            UUID finalExamId,
            ExamAttempt finalAttempt) {
    }
}
