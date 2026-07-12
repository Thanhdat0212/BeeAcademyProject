package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudentAssignmentResponse(
        UUID id,
        String title,
        String description,
        Integer maxScore,
        Instant dueAt,
        UUID chapterId,
        String chapterTitle,
        UUID lessonId,
        String lessonTitle,
        MySubmission mySubmission
) {
    public record MySubmission(
            UUID id,
            String status,
            String content,
            List<AssignmentSubmissionResponse.SubmissionFile> files,
            Integer score,
            String feedback,
            Instant submittedAt,
            Instant gradedAt,
            boolean late
    ) {
    }
}
