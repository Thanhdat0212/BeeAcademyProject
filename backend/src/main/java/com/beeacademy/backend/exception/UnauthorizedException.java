package com.beeacademy.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception cho lỗi xác thực / phân quyền nghiệp vụ.
 *
 * <p>Phân biệt 2 loại:
 * <ul>
 *   <li><b>401 Unauthorized</b> - chưa đăng nhập / token không hợp lệ.
 *       Thường được Spring Security tự xử lý, ít khi service ném.</li>
 *   <li><b>403 Forbidden</b> - đã đăng nhập nhưng không có quyền với
 *       resource cụ thể (vd: user A cố xem profile user B).
 *       Service nên ném loại này.</li>
 * </ul>
 */
public class UnauthorizedException extends BusinessException {

    /** 401 Unauthorized — chưa đăng nhập hoặc token không hợp lệ. */
    public UnauthorizedException(String message) {
        super("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
    }

    /** Code tuỳ chỉnh, vẫn dùng 401. Truyền HttpStatus.FORBIDDEN nếu muốn 403. */
    public UnauthorizedException(String code, String message) {
        super(code, message, HttpStatus.UNAUTHORIZED);
    }

    /** Tường minh chỉ định status khi cần phân biệt 401 vs 403. */
    public UnauthorizedException(String code, String message, HttpStatus status) {
        super(code, message, status);
    }
}
