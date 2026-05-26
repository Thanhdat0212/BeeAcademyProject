package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body cho {@code POST /api/auth/refresh}.
 *
 * <p>Frontend lưu {@code refresh_token} (httpOnly cookie hoặc localStorage)
 * và gọi endpoint này khi access_token hết hạn.
 */
public record RefreshTokenRequest(

        @NotBlank(message = "Refresh token không được để trống")
        String refreshToken
) {
}
