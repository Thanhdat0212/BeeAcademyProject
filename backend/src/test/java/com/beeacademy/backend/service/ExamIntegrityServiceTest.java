package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ExamIntegrityEventResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.ExamIntegrityEvent;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamIntegrityEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamIntegrityServiceTest {

    @Mock private ExamIntegrityEventRepository integrityEventRepository;
    @Mock private ExamAttemptRepository examAttemptRepository;

    @InjectMocks private ExamIntegrityService service;

    @Test
    void serverCountsViolationsAndRequiresAutoSubmitOnlyOnFourthEvent() {
        UUID enrollmentId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        Enrollment enrollment = org.mockito.Mockito.mock(Enrollment.class);
        ExamConfig exam = org.mockito.Mockito.mock(ExamConfig.class);
        ExamAttempt attempt = org.mockito.Mockito.mock(ExamAttempt.class);
        when(enrollment.getId()).thenReturn(enrollmentId);
        when(exam.getId()).thenReturn(examId);
        when(attempt.getId()).thenReturn(attemptId);
        when(integrityEventRepository.findByAttemptIdAndClientEventId(
                org.mockito.ArgumentMatchers.eq(attemptId), any(UUID.class)))
                .thenReturn(Optional.empty());
        when(examAttemptRepository.findByIdForUpdate(attemptId)).thenReturn(Optional.of(attempt));
        when(integrityEventRepository.findMaxViolationCountByAttemptId(attemptId))
                .thenReturn(0, 1, 2, 3);
        when(integrityEventRepository.saveAndFlush(any(ExamIntegrityEvent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ExamIntegrityEventResponse first = service.record(
                enrollment, exam, attempt, UUID.randomUUID(), "TAB_HIDDEN");
        ExamIntegrityEventResponse second = service.record(
                enrollment, exam, attempt, UUID.randomUUID(), "WINDOW_BLUR");
        ExamIntegrityEventResponse third = service.record(
                enrollment, exam, attempt, UUID.randomUUID(), "FULLSCREEN_EXIT");
        ExamIntegrityEventResponse fourth = service.record(
                enrollment, exam, attempt, UUID.randomUUID(), "TAB_HIDDEN");

        assertThat(first.violationCount()).isEqualTo(1);
        assertThat(second.violationCount()).isEqualTo(2);
        assertThat(third.violationCount()).isEqualTo(3);
        assertThat(first.autoSubmitRequired()).isFalse();
        assertThat(second.autoSubmitRequired()).isFalse();
        assertThat(third.autoSubmitRequired()).isFalse();
        assertThat(fourth.violationCount()).isEqualTo(4);
        assertThat(fourth.autoSubmitRequired()).isTrue();
        assertThat(fourth.enrollmentId()).isEqualTo(enrollmentId);
        assertThat(fourth.examId()).isEqualTo(examId);
        assertThat(fourth.attemptId()).isEqualTo(attemptId);
    }

    @Test
    void retryWithSameClientEventIdIsIdempotent() {
        UUID eventId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        Enrollment enrollment = org.mockito.Mockito.mock(Enrollment.class);
        ExamConfig exam = org.mockito.Mockito.mock(ExamConfig.class);
        ExamAttempt attempt = org.mockito.Mockito.mock(ExamAttempt.class);
        when(enrollment.getId()).thenReturn(UUID.randomUUID());
        when(exam.getId()).thenReturn(UUID.randomUUID());
        when(attempt.getId()).thenReturn(attemptId);
        ExamIntegrityEvent existing = ExamIntegrityEvent.record(
                eventId, enrollment, exam, attempt, "TAB_HIDDEN", 2);
        when(integrityEventRepository.findByAttemptIdAndClientEventId(attemptId, eventId))
                .thenReturn(Optional.of(existing));

        ExamIntegrityEventResponse response = service.record(
                enrollment, exam, attempt, eventId, "TAB_HIDDEN");

        assertThat(response.violationCount()).isEqualTo(2);
        verifyNoInteractions(examAttemptRepository);
        verify(integrityEventRepository, never()).saveAndFlush(any());
    }

    @Test
    void invalidEventTypeIsRejectedBeforeWritingAudit() {
        ExamAttempt attempt = org.mockito.Mockito.mock(ExamAttempt.class);

        assertThatThrownBy(() -> service.record(
                org.mockito.Mockito.mock(Enrollment.class),
                org.mockito.Mockito.mock(ExamConfig.class),
                attempt,
                UUID.randomUUID(),
                "COPY_SCRIPT"))
                .isInstanceOfSatisfying(BusinessException.class, ex ->
                        assertThat(((BusinessException) ex).getCode())
                                .isEqualTo("INVALID_INTEGRITY_EVENT_TYPE"));
        verifyNoInteractions(integrityEventRepository, examAttemptRepository);
    }
}
