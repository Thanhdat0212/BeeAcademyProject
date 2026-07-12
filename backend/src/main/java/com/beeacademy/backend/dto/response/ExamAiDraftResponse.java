package com.beeacademy.backend.dto.response;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExamAiDraftResponse(
        UUID promptId,
        List<ExamAiDraftQuestion> questions,
        Instant createdAt
) {
    public record ExamAiDraftQuestion(
            String status,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            JsonNode metadata,
            String explanation,
            String difficulty,
            List<String> sourceRefs,
            String rejectionReason
    ) {
    }
}
