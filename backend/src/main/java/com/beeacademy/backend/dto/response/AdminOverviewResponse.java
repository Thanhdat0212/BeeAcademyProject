package com.beeacademy.backend.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Số liệu tổng hợp cho tab Overview của Admin Dashboard (UC34).
 *
 * <p>Một response gói toàn bộ dữ liệu tab cần — tránh frontend phải gọi
 * 4-5 endpoint riêng lẻ mỗi lần mở dashboard.
 *
 * <p>Mọi số tiền là VND nguyên (long) — cùng convention với
 * {@link TeacherStatsResponse}.
 */
@Builder
public record AdminOverviewResponse(

        /** Tổng GMV all-time: toàn bộ tiền học sinh đã thanh toán. */
        long totalGmv,

        /** Tổng phí nền tảng (30%) công ty giữ lại. */
        long totalPlatformFee,

        /** Phần GV của các kỳ chưa thanh toán → thẻ "Tiền cần chuyển kỳ này". */
        long totalPendingPayout,

        /** platformFee + pendingPayout → thẻ "Tổng tiền đang giữ". */
        long totalFundsHeld,

        /** Số GV có kỳ chưa PAID thuộc tháng đã qua → thẻ "Cảnh báo trễ hạn". */
        long overdueTeacherCount,

        /** 5 đơn PAID gần nhất → bảng "Đơn hàng vừa thanh toán". */
        List<RecentOrder> recentOrders,

        /** Top 5 khóa PUBLISHED theo enrollment → "Bảng xếp hạng khóa học". */
        List<TopCourse> topCourses
) {

    /**
     * Một đơn hàng đã thanh toán. {@code courseTitles} gộp sẵn tên các khóa
     * trong đơn (giỏ hàng nhiều khóa) — frontend hiển thị nguyên chuỗi.
     * {@code paidAt} không bao giờ null (service coalesce sang createdAt).
     */
    public record RecentOrder(
            UUID id,
            String paymentRef,
            String studentName,
            String courseTitles,
            int amount,
            Instant paidAt
    ) {}

    /** Một dòng trong bảng xếp hạng — đã sort sẵn theo enrollmentCount giảm dần. */
    public record TopCourse(
            UUID id,
            String title,
            String teacherName,
            String categoryName,
            long enrollmentCount
    ) {}
}
