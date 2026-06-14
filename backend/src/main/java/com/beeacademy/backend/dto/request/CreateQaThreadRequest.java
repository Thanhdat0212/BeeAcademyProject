package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateQaThreadRequest(
        @NotNull(message = "Vui lòng chọn khóa học")
        UUID courseId,

        UUID lessonId,

        @NotBlank(message = "Vui lòng nhập nội dung câu hỏi")
        @Size(max = 5000, message = "Câu hỏi tối đa 5000 ký tự")
        String content
) {
}
