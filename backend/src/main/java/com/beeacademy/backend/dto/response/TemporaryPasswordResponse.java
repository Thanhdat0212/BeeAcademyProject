package com.beeacademy.backend.dto.response;

import java.util.UUID;

/**
 * Response cho 2 thao tác Admin cấp mật khẩu tạm: tạo tài khoản giáo viên mới
 * và cấp lại mật khẩu cho tài khoản đã có.
 *
 * <p><b>Đây là lần duy nhất {@code temporaryPassword} rời khỏi backend.</b>
 * Mật khẩu không được lưu plaintext trong DB, không log, không có endpoint nào
 * đọc lại được. Admin phải copy ngay để gửi cho GV qua Zalo/Facebook.
 *
 * @param id                UUID tài khoản
 * @param email             email đăng nhập
 * @param fullName          họ tên
 * @param temporaryPassword mật khẩu tạm - hiển thị đúng 1 lần
 * @param emailSent         false nghĩa là SMTP lỗi, Admin BẮT BUỘC phải gửi
 *                          mật khẩu bằng tay qua kênh mạng xã hội
 */
public record TemporaryPasswordResponse(
        UUID id,
        String email,
        String fullName,
        String temporaryPassword,
        boolean emailSent
) {
}
