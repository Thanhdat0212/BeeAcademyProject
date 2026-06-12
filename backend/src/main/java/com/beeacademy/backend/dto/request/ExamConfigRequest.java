package com.beeacademy.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ExamConfigRequest(
        @NotBlank
        @Size(max = 255)
        String name,

        @Size(max = 2000)
        String description,

        @NotNull @Min(1) @Max(300)
        Integer durationMinutes,

        @NotNull @Min(0) @Max(100)
        Integer passScorePercent,

        @NotNull @Min(1) @Max(10)
        Integer maxAttempts,

        boolean shuffleQuestions,
        boolean shuffleOptions,
        boolean showAnswerAfterSubmit,

        @NotNull @Size(min = 1, max = 200)
        @Valid
        List<ExamQuestionRequest> questions
) {
    public record ExamQuestionRequest(
            String id,

            @NotBlank
            @Size(max = 5000)
            String text,

            @NotNull
            @Pattern(regexp = "single|multiple")
            String type,

            @NotNull @Size(min = 2, max = 6)
            List<@NotBlank String> options,

            @NotNull @Size(min = 1, max = 6)
            List<@Min(0) Integer> correctIndices,

            @Size(max = 2000)
            String explanation,

            @NotNull @DecimalMin("0.01") @DecimalMax("100")
            Double points,

            @NotNull
            @Pattern(regexp = "easy|medium|hard")
            String difficulty
    ) {}
}
