package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ExamAiReviewRequest(
        @NotNull
        UUID promptId,

        @NotBlank
        @Pattern(regexp = "APPROVED_AI_QUESTION|REJECTED_AI_QUESTION")
        String action,

        @NotBlank
        @Size(max = 5000)
        String questionText,

        JsonNode sourceRefs
) {
}
