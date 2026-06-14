package com.beeacademy.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * Wrapper chuẩn cho mọi response LỖI của API.
 *
 * <p>Trả về bởi {@code GlobalExceptionHandler} → đảm bảo frontend luôn parse
 * lỗi theo cùng 1 shape:
 * <pre>
 * {
 *   "success": false,
 *   "code": "EMAIL_ALREADY_EXISTS",
 *   "message": "Email đã được sử dụng",
 *   "fieldErrors": [
 *     { "field": "email", "message": "Sai định dạng" }
 *   ],
 *   "timestamp": "2026-05-25T10:30:00Z"
 * }
 * </pre>
 *
 * <p>{@code @JsonInclude(NON_NULL)} → field {@code fieldErrors} không xuất
 * hiện trong JSON khi null (đỡ noise).
 *
 * @param success     luôn {@code false} cho ErrorResponse - giữ field này
 *                    để client có thể check thống nhất với {@link ApiResponse}
 * @param code        mã lỗi nghiệp vụ (vd: {@code EMAIL_ALREADY_EXISTS},
 *                    {@code INVALID_INPUT}) - frontend dùng để hiển thị message i18n
 * @param message     mô tả lỗi cho người dùng (tiếng Việt)
 * @param fieldErrors danh sách lỗi theo từng field (cho validation errors).
 *                    Null nếu không phải lỗi field-level.
 * @param timestamp   thời điểm lỗi xảy ra
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        boolean success,
        String code,
        String message,
        List<FieldError> fieldErrors,
        Instant timestamp
) {

    /**
     * Lỗi gắn với 1 field cụ thể trong request body.
     * Vd: {@code {field: "email", message: "Email không hợp lệ"}}.
     */
    public record FieldError(String field, String message) {
    }

    /**
     * Factory cho lỗi nghiệp vụ thường (không có field errors).
     *
     * @param code    mã lỗi nội bộ
     * @param message message tiếng Việt cho user
     */
    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(false, code, message, null, Instant.now());
    }

    /**
     * Factory cho lỗi validation (có danh sách field errors).
     */
    public static ErrorResponse ofValidation(String message, List<FieldError> fieldErrors) {
        return new ErrorResponse(false, "VALIDATION_FAILED", message, fieldErrors, Instant.now());
    }
}
