package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ParentPaymentHistoryResponse(
        UUID studentId,
        String studentName,
        String gradeLabel,
        Instant generatedAt,
        long totalPaidAmount,
        int transactionCount,
        int pendingCount,
        double averageProgress,
        List<Transaction> transactions
) {
    public record Transaction(
            UUID orderId,
            Long orderCode,
            String paymentRef,
            UUID payerId,
            String payerName,
            String payerRole,
            UUID courseId,
            String courseTitle,
            String teacherName,
            String categoryName,
            String thumbnailUrl,
            List<Integer> grades,
            Integer amountVnd,
            OrderStatus status,
            Instant createdAt,
            Instant paidAt,
            Integer currentProgressPct,
            String invoiceCode
    ) {
    }
}
