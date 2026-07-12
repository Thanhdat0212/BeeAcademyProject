package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ModerateCourseReviewRequest(
        @NotNull ModerationDecision decision,
        @Size(max = 500) String reason
) {
    public enum ModerationDecision {
        APPROVE,
        REJECT
    }
}
