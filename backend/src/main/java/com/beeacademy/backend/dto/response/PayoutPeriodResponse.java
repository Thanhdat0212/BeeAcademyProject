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
    UUID paidByAdmin,
    String transferRef,
    String transferContent,
    String uncAttachmentUrl
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
                .paidByAdmin(p.getPaidByAdmin())
                .transferRef(p.getTransferRef())
                .transferContent(p.getTransferContent())
                .uncAttachmentUrl(p.getUncAttachmentUrl())
                .build();
    }
}
