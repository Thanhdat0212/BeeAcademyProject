package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * DTO yêu cầu gửi mã OTP phục hồi mật khẩu.
 */
public record RequestResetPasswordOtpRequest(
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    String email
) {}
