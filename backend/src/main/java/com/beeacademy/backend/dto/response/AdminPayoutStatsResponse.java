package com.beeacademy.backend.dto.response;

/**
 * 3 thẻ thống kê đầu trang Kế toán & Lương (UC37).
 * Mọi số là VND nguyên (long).
 */
public record AdminPayoutStatsResponse(
        /** Tổng doanh thu (GMV) phát sinh trong tháng hiện tại. */
        long currentMonthGross,

        /** Tiền GV của các kỳ chưa PAID — cần đối soát & chuyển khoản. */
        long pendingTeacherAmount,

        /** Lợi nhuận ròng nền tảng (tổng platform fee all-time). */
        long netPlatformFee
) {
}
