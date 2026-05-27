package com.beeacademy.backend.dto.response;

import java.time.Instant;

/**
 * Wrapper chuẩn cho mọi response THÀNH CÔNG của API.
 *
 * <p>Mục đích: thống nhất shape JSON trả về client → frontend luôn biết
 * tìm dữ liệu ở field {@code data}, message ở {@code message}. Lỗi sẽ
 * dùng {@link ErrorResponse} riêng (do {@code GlobalExceptionHandler} trả).
 *
 * <p>Ví dụ output JSON:
 * <pre>
 * {
 *   "success": true,
 *   "message": "OK",
 *   "data": { ... },
 *   "timestamp": "2026-05-25T10:30:00Z"
 * }
 * </pre>
 *
 * @param <T> kiểu của payload (Course, List&lt;Course&gt;, Map, ...)
 */
public record ApiResponse<T>(
        boolean success,
        String message,
        T data,
        Instant timestamp
) {

    /**
     * Factory ngắn gọn cho response thành công với data.
     * Dùng khi đa số trường hợp không cần message tuỳ chỉnh.
     */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", data, Instant.now());
    }

    /**
     * Factory cho response thành công kèm message tuỳ chỉnh.
     * Vd: sau khi register thành công có thể trả "Vui lòng kiểm tra email để xác thực".
     */
    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, message, data, Instant.now());
    }
}
