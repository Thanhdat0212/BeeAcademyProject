package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.BankVerifyStatus;
import com.beeacademy.backend.model.TeacherBankAccount;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record BankInfoResponse(
    UUID id,
    String bankName,
    String accountNumber,
    String accountHolder,
    String branch,
    BankVerifyStatus verifyStatus,
    Instant updatedAt
) {
    public static BankInfoResponse from(TeacherBankAccount b) {
        return BankInfoResponse.builder()
                .id(b.getId())
                .bankName(b.getBankName())
                .accountNumber(b.getAccountNumber())
                .accountHolder(b.getAccountHolder())
                .branch(b.getBranch())
                .verifyStatus(b.getVerifyStatus())
                .updatedAt(b.getUpdatedAt())
                .build();
    }
}
