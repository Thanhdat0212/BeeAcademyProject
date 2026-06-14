package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.PayoutStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Một dòng trong bảng đối soát lương GV của Admin (UC37/39/40).
 * Mỗi dòng = 1 kỳ thanh toán (1 GV / 1 tháng) kèm TK ngân hàng + tổng tiền.
 *
 * <p>{@code overdue} = kỳ chưa PAID thuộc tháng đã qua (Admin chậm chuyển khoản)
 * — tính ở service từ monthYear so với tháng hiện tại.
 */
public record AdminPayoutRowResponse(
        UUID periodId,
        UUID teacherId,
        String teacherName,
        String monthYear,
        String bankName,
        String accountNumber,
        String accountHolder,
        long totalGross,
        long platformFee,
        long teacherAmount,
        long transactionCount,
        PayoutStatus status,
        boolean overdue,
        Instant paidAt,
        String transferRef,
        String transferContent
) {
}
