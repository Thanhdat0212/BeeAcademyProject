package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body cho {@code POST /api/auth/reset-password} (UC04).
 *
 * <p>Chỉ cần email. Service KHÔNG kiểm tra email có tồn tại hay không -
 * để tránh enumeration attack (kẻ tấn công đoán email bằng cách so sánh
 * response).
 */
public record ResetPasswordRequest(

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không đúng định dạng")
        String email
) {
}
