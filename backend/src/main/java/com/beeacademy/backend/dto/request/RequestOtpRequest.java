package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RequestOtpRequest(

        @NotBlank(message = "Email không được trống")
        @Email(message = "Email không hợp lệ")
        @Size(max = 255)
        String email,

        @NotBlank(message = "Họ tên không được trống")
        @Size(min = 2, max = 100, message = "Họ tên từ 2–100 ký tự")
        String fullName,

        @NotBlank(message = "Vai trò không được trống")
        @Pattern(regexp = "student|parent|teacher", message = "Vai trò chỉ được là student, parent hoặc teacher")
        String role
) {}
