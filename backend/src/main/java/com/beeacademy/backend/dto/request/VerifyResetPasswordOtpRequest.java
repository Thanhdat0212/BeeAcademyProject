package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO yêu cầu xác minh OTP và đổi mật khẩu mới.
 */
public record VerifyResetPasswordOtpRequest(
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    String email,

    @NotBlank(message = "Mã OTP không được để trống")
    @Size(min = 6, max = 6, message = "Mã OTP phải có đúng 6 ký tự")
    String otp,

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Size(min = 6, message = "Mật khẩu mới phải có tối thiểu 6 ký tự")
    String newPassword
) {}
