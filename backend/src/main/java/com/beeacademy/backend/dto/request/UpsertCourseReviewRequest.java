package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertCourseReviewRequest(
        @Min(1) @Max(5)
        Integer rating,
        @NotBlank
        @Size(min = 20, max = 1000)
        String comment
) {
}
