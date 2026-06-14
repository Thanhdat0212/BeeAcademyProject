package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.UUID;

/** Cấu hình quiz cho một chương (GV). Upsert — tạo mới hoặc cập nhật. */
public record QuizConfigRequest(

        @NotNull @Min(1) @Max(100)
        Integer totalQuestions,

        @NotNull @Min(0)
        Integer easyCount,

        @NotNull @Min(0)
        Integer mediumCount,

        @NotNull @Min(0)
        Integer hardCount,

        Integer timeLimitMinutes,   // null = không giới hạn

        @NotNull
        @DecimalMin("1.0") @DecimalMax("10.0")
        Double passingScore,

        boolean shuffleQuestions,
        boolean shuffleChoices,

        Integer maxAttempts,        // null = không giới hạn

        /** "random" (mặc định) hoặc "manual" */
        @Pattern(regexp = "random|manual")
        String selectionMode,

        /** Danh sách ID câu hỏi được chọn thủ công (chỉ khi selectionMode = "manual") */
        List<UUID> selectedQuestionIds
) {}
