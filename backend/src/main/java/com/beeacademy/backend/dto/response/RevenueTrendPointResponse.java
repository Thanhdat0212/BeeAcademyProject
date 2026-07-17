package com.beeacademy.backend.dto.response;

/**
 * Một điểm dữ liệu doanh thu theo tháng cho biểu đồ trang Báo cáo (UC37).
 *
 * <p>{@code month} định dạng "yyyy-MM". Mọi số tiền là VND nguyên (long) —
 * cùng convention với {@link TeacherStatsResponse} và {@link AdminOverviewResponse}.
 */
public record RevenueTrendPointResponse(
        String month,
        long gross,
        long teacherAmount,
        long platformFee,
        long count
) {}
