package com.beeacademy.backend.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Exception cho mọi lỗi NGHIỆP VỤ (business rule vi phạm).
 *
 * <p>Khác với lỗi kỹ thuật (NPE, DB connection lost...), {@code BusinessException}
 * là lỗi "dự kiến được" - người dùng đã làm sai theo luật nghiệp vụ
 * (vd: mua khoá học đã sở hữu, gửi quiz khi chưa hoàn thành chương).
 *
 * <p>Triết lý: service ném {@code BusinessException} kèm:
 * <ul>
 *   <li>{@code code}: mã ngắn không đổi (vd: {@code EMAIL_ALREADY_EXISTS})
 *       → frontend dùng để show i18n message.</li>
 *   <li>{@code message}: text tiếng Việt rõ ràng, fallback khi frontend
 *       chưa có bản dịch.</li>
 *   <li>{@code status}: HTTP status code mong muốn (400, 403, 404, 409...).
 *       {@code GlobalExceptionHandler} sẽ dùng giá trị này khi trả response.</li>
 * </ul>
 *
 * <p>Kế thừa {@link RuntimeException} (unchecked) → service không phải khai
 * báo {@code throws} dày đặc.
 */
@Getter
public class BusinessException extends RuntimeException {

    /** Mã lỗi nội bộ - hằng số như "EMAIL_ALREADY_EXISTS", "PROFILE_NOT_FOUND". */
    private final String code;

    /** HTTP status code trả về cho client - mặc định 400 Bad Request. */
    private final HttpStatus status;

    /**
     * Constructor đầy đủ.
     *
     * @param code    mã lỗi nội bộ
     * @param message message hiển thị cho user (tiếng Việt)
     * @param status  HTTP status code
     */
    public BusinessException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    /** Constructor tắt - mặc định HTTP 400. */
    public BusinessException(String code, String message) {
        this(code, message, HttpStatus.BAD_REQUEST);
    }
}
