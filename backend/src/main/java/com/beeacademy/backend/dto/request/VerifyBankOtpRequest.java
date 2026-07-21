package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Bước 2 của luồng đổi TK ngân hàng: GV nhập mã 6 số nhận qua email.
 *
 * <p>Không nhận lại thông tin TK ở đây — payload đã được giữ ở server từ bước 1.
 * Nếu cho client gửi lại thông tin TK kèm mã, kẻ tấn công có thể xin mã cho một
 * thay đổi vô hại rồi dùng chính mã đó commit một số TK khác.
 */
public record VerifyBankOtpRequest(
        @NotBlank
        @Pattern(regexp = "\\d{6}", message = "Mã xác nhận gồm 6 chữ số")
        String otpCode
) {
}
