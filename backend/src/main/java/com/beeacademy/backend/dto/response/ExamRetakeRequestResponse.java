package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ExamRetakeRequest;

import java.time.Instant;
import java.util.UUID;

public record ExamRetakeRequestResponse(
        UUID id,
        UUID examConfigId,
        UUID courseId,
        String courseTitle,
        Integer slotIndex,
        String examName,
        UUID studentId,
        String studentName,
        String status,
        String requestedReason,
        Integer extraAttempts,
        String decidedReason,
        Instant retakeExpireAt,
        Instant createdAt,
        Instant decidedAt,
        Integer attemptsUsed,
        Integer maxAttempts
) {
    public static ExamRetakeRequestResponse fromEntity(
            ExamRetakeRequest request, int attemptsUsed, int maxAttempts) {
        return new ExamRetakeRequestResponse(
                request.getId(),
                request.getExamConfig().getId(),
                request.getExamConfig().getCourse().getId(),
                request.getExamConfig().getCourse().getTitle(),
                request.getExamConfig().getSlotIndex(),
                request.getExamConfig().getName(),
                request.getStudent().getId(),
                request.getStudent().getFullName() != null
                        ? request.getStudent().getFullName()
                        : "Học sinh",
                request.getStatus().name(),
                request.getRequestedReason(),
                request.getExtraAttempts(),
                request.getDecidedReason(),
                request.getRetakeExpireAt(),
                request.getCreatedAt(),
                request.getDecidedAt(),
                attemptsUsed,
                maxAttempts
        );
    }
}
