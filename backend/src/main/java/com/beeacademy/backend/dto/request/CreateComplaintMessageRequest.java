package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateComplaintMessageRequest(
        @NotBlank(message = "Vui long nhap noi dung tin nhan")
        @Size(max = 5000, message = "Tin nhan toi da 5000 ky tu")
        String content
) {
}
