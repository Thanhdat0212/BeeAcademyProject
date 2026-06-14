package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.PayoutPeriod;
import com.beeacademy.backend.model.PayoutStatus;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record PayoutPeriodResponse(
    UUID id,
    String monthYear,
    long transactionCount,
    long totalGross,
    long totalPlatformFee,
    long totalTeacherAmount,
    PayoutStatus status,
    Instant paidAt,
    String transferRef,
    String transferContent
) {
    public static PayoutPeriodResponse from(PayoutPeriod p,
                                             long transactionCount,
                                             long totalGross,
                                             long totalTeacherAmount) {
        return PayoutPeriodResponse.builder()
                .id(p.getId())
                .monthYear(p.getMonthYear())
                .transactionCount(transactionCount)
                .totalGross(totalGross)
                .totalPlatformFee(totalGross - totalTeacherAmount)
                .totalTeacherAmount(totalTeacherAmount)
                .status(p.getStatus())
                .paidAt(p.getPaidAt())
                .transferRef(p.getTransferRef())
                .transferContent(p.getTransferContent())
                .build();
    }
}
