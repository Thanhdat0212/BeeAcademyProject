package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VerifyOtpRequest(

        @NotBlank(message = "Email không được trống")
        @Email(message = "Email không hợp lệ")
        String email,

        @NotBlank(message = "Mã OTP không được trống")
        @Size(min = 6, max = 6, message = "Mã OTP phải đúng 6 chữ số")
        @Pattern(regexp = "\\d{6}", message = "Mã OTP chỉ gồm chữ số")
        String otp,

        @NotBlank(message = "Mật khẩu không được trống")
        @Size(min = 8, message = "Mật khẩu tối thiểu 8 ký tự")
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*\\d).{8,}$",
                 message = "Mật khẩu cần ít nhất 1 chữ hoa và 1 chữ số")
        String password
) {}
