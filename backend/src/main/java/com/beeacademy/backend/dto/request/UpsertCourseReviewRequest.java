package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record UpsertCourseReviewRequest(
        @Min(1) @Max(5)
        Integer rating,
        @Size(max = 2000)
        String comment
) {
}
