package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin xác nhận đã chuyển khoản thủ công cho GV (UC40).
 */
public record ConfirmPayoutRequest(
        @NotBlank(message = "Vui lòng nhập mã giao dịch ngân hàng")
        @Size(max = 100, message = "Mã giao dịch tối đa 100 ký tự")
        String transferRef,

        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String transferContent
) {
}
