package com.beeacademy.backend.dto.response;

/**
 * Điểm dữ liệu dạng (nhãn, số lượng) dùng chung cho các biểu đồ Reports (UC37):
 * lượt đăng ký theo tháng, người dùng mới theo tháng, khóa học theo danh mục.
 *
 * <p>Với time-series thì {@code label} là tháng "yyyy-MM"; với phân bố thì
 * {@code label} là tên danh mục / vai trò.
 */
public record CountPointResponse(
        String label,
        long count
) {}
