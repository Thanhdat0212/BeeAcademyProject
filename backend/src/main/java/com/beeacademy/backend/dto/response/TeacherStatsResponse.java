package com.beeacademy.backend.dto.response;

import lombok.Builder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tổng hợp tất cả số liệu cần thiết cho dashboard giáo viên trong 1 response.
 *
 * <p>Được tính server-side thay vì để frontend load toàn bộ splits rồi tính —
 * giảm payload và tránh lỗi đếm trùng tên học viên.
 */
@Builder
public record TeacherStatsResponse(

        // ── Doanh thu ──────────────────────────────────────────────────────────

        /** Tiền giáo viên nhận được trong tháng hiện tại (từ revenue_splits). */
        long currentMonthRevenue,

        /** Tiền giáo viên nhận được trong tháng trước (để tính % thay đổi). */
        long previousMonthRevenue,

        // ── Học viên ────────────────────────────────────────────────────────

        /**
         * Số học viên duy nhất đã mua ít nhất 1 khóa của giáo viên (từ enrollments).
         * Không đếm trùng nếu 1 học viên mua nhiều khóa.
         */
        long uniqueStudentsTotal,

        // ── Lượt bán ───────────────────────────────────────────────────────

        /** Số đơn hàng thành công trong tháng hiện tại (từ revenue_splits). */
        long currentMonthSalesCount,

        /** Số đơn hàng thành công trong tháng trước (để tính % thay đổi). */
        long previousMonthSalesCount,

        // ── Khóa học ───────────────────────────────────────────────────────

        /** Số khóa học đang ở trạng thái PUBLISHED. */
        long publishedCoursesCount,

        /**
         * Map courseId → số lượng enrollment (học viên đã mua).
         * Dùng để vẽ bar chart trên dashboard (Top 5 khóa học).
         */
        Map<UUID, Long> courseEnrollmentCounts,

        // ── Giao dịch gần đây ──────────────────────────────────────────────

        /** 8 giao dịch gần nhất (revenue_splits) — hiển thị bảng "Doanh số gần đây". */
        List<RevenueSplitResponse> recentSplits

) {
}
