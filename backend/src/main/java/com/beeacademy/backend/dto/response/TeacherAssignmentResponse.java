package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

public record TeacherAssignmentResponse(
        UUID id,
        String title,
        String description,
        Integer maxScore,
        Instant dueAt,
        Integer maxAttempts,
        Boolean allowLateSubmission,
        Integer latePenaltyPercent,
        Boolean acceptingSubmissions,
        UUID courseId,
        String courseTitle,
        UUID chapterId,
        String chapterTitle,
        UUID lessonId,
        String lessonTitle,
        Instant createdAt
) {
}
