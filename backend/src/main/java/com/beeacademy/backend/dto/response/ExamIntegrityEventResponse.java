package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ExamIntegrityEvent;

import java.time.Instant;
import java.util.UUID;

public record ExamIntegrityEventResponse(
        UUID eventId,
        UUID enrollmentId,
        UUID examId,
        UUID attemptId,
        String eventType,
        Integer violationCount,
        boolean autoSubmitRequired,
        Instant occurredAt
) {
    private static final int AUTO_SUBMIT_VIOLATION_COUNT = 4;

    public static ExamIntegrityEventResponse fromEntity(ExamIntegrityEvent event) {
        return new ExamIntegrityEventResponse(
                event.getClientEventId(),
                event.getEnrollment().getId(),
                event.getExamConfig().getId(),
                event.getAttempt().getId(),
                event.getEventType(),
                event.getViolationCount(),
                event.getViolationCount() >= AUTO_SUBMIT_VIOLATION_COUNT,
                event.getOccurredAt());
    }
}
