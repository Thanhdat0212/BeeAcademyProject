package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body cho {@code POST /api/auth/login} (UC02).
 *
 * <p>Validation tối thiểu - không kiểm tra format password chi tiết
 * (việc đó để Supabase tự verify). Mục tiêu là chặn request trống.
 */
public record LoginRequest(

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không đúng định dạng")
        String email,

        @NotBlank(message = "Mật khẩu không được để trống")
        String password
) {
}
