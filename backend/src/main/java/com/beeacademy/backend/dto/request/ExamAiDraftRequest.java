package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ExamAiDraftRequest(
        UUID chapterId,

        @NotBlank
        @Size(max = 5000)
        String prompt,

        @Size(max = 12000)
        String material,

        @NotNull @Min(1) @Max(50)
        Integer questionCount,

        @NotNull
        @Pattern(regexp = "multiple_choice|true_false|fill_in_blank|essay")
        String questionType,

        @NotNull
        @Pattern(regexp = "easy|medium|hard")
        String difficulty
) {
}
