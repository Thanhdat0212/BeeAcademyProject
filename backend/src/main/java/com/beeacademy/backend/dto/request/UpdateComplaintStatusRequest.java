package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Pattern;

/**
 * Admin đổi trạng thái khiếu nại (UC38). Chỉ chấp nhận các trạng thái Admin
 * được phép set thủ công — không cho set 'pending' (trạng thái khởi tạo).
 */
public record UpdateComplaintStatusRequest(
        @Pattern(regexp = "in_progress|resolved|rejected",
                 message = "Trạng thái không hợp lệ")
        String status
) {
}
