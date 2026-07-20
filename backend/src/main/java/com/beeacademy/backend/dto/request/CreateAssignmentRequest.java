package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CreateAssignmentRequest(
        UUID chapterId,

        UUID lessonId,

        @NotBlank(message = "Tiêu đề bài tập không được để trống")
        @Size(max = 300, message = "Tiêu đề tối đa 300 ký tự")
        String title,

        @Size(max = 5000, message = "Mô tả tối đa 5000 ký tự")
        String description,

        @NotNull(message = "Điểm tối đa không được để trống")
        @Min(value = 1, message = "Điểm tối đa phải từ 1")
        @Max(value = 100, message = "Điểm tối đa không vượt quá 100")
        Integer maxScore,

        Instant dueAt,

        @Min(value = 1, message = "Số lần nộp tối đa phải từ 1")
        Integer maxAttempts,

        Boolean allowLateSubmission,

        @Min(value = 0, message = "Mức trừ điểm nộp muộn không được âm")
        @Max(value = 100, message = "Mức trừ điểm nộp muộn không vượt quá 100%")
        Integer latePenaltyPercent,

        Boolean acceptingSubmissions
) {
}
