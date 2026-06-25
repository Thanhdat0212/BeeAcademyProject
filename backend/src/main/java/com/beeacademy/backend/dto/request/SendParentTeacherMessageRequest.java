package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SendParentTeacherMessageRequest(
        @NotNull(message = "Vui lòng chọn khóa học")
        UUID courseId,

        @NotBlank(message = "Vui lòng nhập nội dung tin nhắn")
        @Size(max = 5000, message = "Tin nhắn tối đa 5000 ký tự")
        String content
) {
}
