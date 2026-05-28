package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Request body cho {@code POST /api/auth/change-password}.
 *
 * <p>Yêu cầu nhập mật khẩu hiện tại để chống tình huống ai đó cướp được
 * session đang đăng nhập (token chưa hết hạn) có thể đổi pass và khoá
 * chủ sở hữu.
 *
 * @param currentPassword mật khẩu hiện tại - service verify lại với Supabase
 * @param newPassword     mật khẩu mới - phải khác current và đáp ứng policy
 */
public record ChangePasswordRequest(

        @NotBlank(message = "Mật khẩu hiện tại không được để trống")
        String currentPassword,

        @NotBlank(message = "Mật khẩu mới không được để trống")
        @Pattern(
                regexp = "^(?=.*[A-Z])(?=.*\\d).{8,}$",
                message = "Mật khẩu mới tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số"
        )
        String newPassword
) {
}
