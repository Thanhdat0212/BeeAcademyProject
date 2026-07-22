package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;

/**
 * Kết quả bước 1 của luồng đổi TK ngân hàng: mã xác nhận đã được gửi đi.
 *
 * <p>Cố tình KHÔNG trả về mã OTP và KHÔNG trả email đầy đủ — chỉ dạng che
 * ({@code th***@gmail.com}) đủ để GV nhận ra hộp thư nào cần mở, nhưng không
 * lộ thêm địa chỉ thật cho người đang mượn session.
 *
 * @param maskedEmail email nhận mã, đã che phần giữa
 * @param expiresAt   thời điểm mã hết hạn — frontend dựng đồng hồ đếm ngược
 * @param changes     các trường sẽ đổi, để GV đối chiếu trước khi nhập mã
 */
public record BankChangeRequestResponse(
        String maskedEmail,
        Instant expiresAt,
        List<BankFieldChange> changes
) {
}
