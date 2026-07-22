package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateQaThreadRequest(
        @NotNull(message = "Vui lòng chọn khóa học")
        UUID courseId,

        UUID lessonId,

        @NotBlank(message = "Vui lòng nhập tiêu đề câu hỏi")
        @Size(max = 180, message = "Tiêu đề tối đa 180 ký tự")
        String title,

        @NotBlank(message = "Vui lòng nhập nội dung câu hỏi")
        @Size(min = 10, max = 5000, message = "Nội dung câu hỏi phải từ 10 đến 5000 ký tự")
        String content,

        @Size(max = 16) String visibility,

        @Size(max = 1000) String attachmentUrl,
        @Size(max = 255) String attachmentName,
        @Size(max = 100) String attachmentType,
        Long attachmentSizeBytes
) {
}
