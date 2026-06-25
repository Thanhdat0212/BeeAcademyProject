package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendParentLinkInvitationRequest(
        @NotBlank(message = "Email học sinh không được để trống")
        @Email(message = "Email học sinh không hợp lệ")
        @Size(max = 255, message = "Email học sinh quá dài")
        String studentEmail
) {
}
