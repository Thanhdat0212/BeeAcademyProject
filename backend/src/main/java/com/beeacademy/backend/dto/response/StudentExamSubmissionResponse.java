package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

public record StudentExamSubmissionResponse(
        UUID attemptId,
        UUID examId,
        String examName,
        Integer slotIndex,
        Integer attemptNumber,
        Double autoScorePercent,
        Boolean passed,
        String status,
        Integer correctObjectiveCount,
        Integer totalObjectiveCount,
        Instant submittedAt
) {
}
