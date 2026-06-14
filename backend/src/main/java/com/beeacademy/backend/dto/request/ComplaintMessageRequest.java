package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ComplaintMessageRequest(
        @NotBlank(message = "Vui lòng nhập nội dung")
        @Size(max = 5000, message = "Nội dung tối đa 5000 ký tự")
        String content
) {
}
