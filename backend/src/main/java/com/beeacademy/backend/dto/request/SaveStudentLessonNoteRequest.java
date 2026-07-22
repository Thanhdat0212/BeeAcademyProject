package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record SaveStudentLessonNoteRequest(
        @NotNull(message = "Mốc thời gian là bắt buộc")
        @PositiveOrZero(message = "Mốc thời gian không được âm")
        @Max(value = 604800, message = "Mốc thời gian không hợp lệ")
        Integer timeSec,

        @NotBlank(message = "Nội dung ghi chú là bắt buộc")
        @Size(max = 2000, message = "Ghi chú tối đa 2000 ký tự")
        String content
) {
}
