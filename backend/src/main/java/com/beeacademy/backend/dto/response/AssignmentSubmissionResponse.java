package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AssignmentSubmissionResponse(
        UUID id,
        UUID assignmentId,
        String assignmentTitle,
        String assignmentInstructions,
        UUID courseId,
        String courseTitle,
        UUID studentId,
        String studentName,
        String answerText,
        List<SubmissionFile> files,
        Integer attemptNumber,
        String status,
        Double score,
        Double maxScore,
        String feedback,
        Instant submittedAt,
        Instant gradedAt,
        Instant dueAt,
        Boolean late
) {
    public record SubmissionFile(
            String name,
            String url,
            String type,
            Long sizeBytes
    ) {
    }
}
