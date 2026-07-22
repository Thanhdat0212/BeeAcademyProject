package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

public record ExamQuestionRandomRequest(
        @NotNull @Min(0) @Max(200)
        Integer easyCount,

        @NotNull @Min(0) @Max(200)
        Integer mediumCount,

        @NotNull @Min(0) @Max(200)
        Integer hardCount,

        @NotNull @DecimalMin("0.01") @DecimalMax("100")
        Double pointsPerQuestion,

        @DecimalMin("0.01") @DecimalMax("10")
        Double objectivePoints,

        @DecimalMin("0.01") @DecimalMax("10")
        Double essayPoints,

        List<@Valid ChapterQuestionRandomRequest> chapterConfigs
) {
    public record ChapterQuestionRandomRequest(
            @NotNull
            UUID chapterId,

            @NotNull @Min(0) @Max(200)
            Integer totalCount,

            @Min(0) @Max(200)
            Integer objectiveCount,

            @Min(0) @Max(200)
            Integer essayCount,

            @Min(0) @Max(200)
            Integer multipleChoiceCount,

            @Min(0) @Max(200)
            Integer trueFalseCount,

            @Min(0) @Max(200)
            Integer fillInBlankCount,

            @Min(0) @Max(200)
            Integer imageQuestionCount,

            @Min(0) @Max(200)
            Integer easyCount,

            @Min(0) @Max(200)
            Integer mediumCount,

            @Min(0) @Max(200)
            Integer hardCount
    ) {
    }
}
