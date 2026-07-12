package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQaMessageRequest(
        @NotBlank(message = "Vui lòng nhập nội dung tin nhắn")
        @Size(max = 5000, message = "Tin nhắn tối đa 5000 ký tự")
        String content,

        @Size(max = 1000) String attachmentUrl,
        @Size(max = 255) String attachmentName,
        @Size(max = 100) String attachmentType,
        Long attachmentSizeBytes
) {
}
