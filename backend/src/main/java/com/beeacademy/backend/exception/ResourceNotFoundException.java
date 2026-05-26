package com.beeacademy.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception cho trường hợp tài nguyên không tồn tại.
 *
 * <p>Dùng khi truy vấn theo id mà repository trả {@code Optional.empty()}.
 * Ví dụ: {@code GET /api/courses/{id}} mà id không có trong DB.
 *
 * <p>Tự động map sang HTTP 404 qua {@code GlobalExceptionHandler}.
 *
 * <p>Convention: code = {@code <RESOURCE>_NOT_FOUND} (vd: {@code COURSE_NOT_FOUND}).
 */
public class ResourceNotFoundException extends BusinessException {

    /**
     * Helper khởi tạo nhanh từ tên resource và id.
     *
     * @param resourceName tên tài nguyên (vd: "Course", "Profile")
     * @param id           giá trị id đã tra cứu
     */
    public ResourceNotFoundException(String resourceName, Object id) {
        super(
                resourceName.toUpperCase() + "_NOT_FOUND",
                "Không tìm thấy " + resourceName + " với id: " + id,
                HttpStatus.NOT_FOUND
        );
    }
}
