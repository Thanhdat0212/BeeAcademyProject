package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.BankVerifyStatus;
import com.beeacademy.backend.model.TeacherBankAccount;

import java.time.Instant;
import java.util.UUID;

public record AdminBankAccountResponse(
        UUID teacherId,
        String teacherName,
        String bankName,
        String accountNumber,
        String accountHolder,
        String branch,
        BankVerifyStatus verifyStatus,
        Instant updatedAt
) {
    public static AdminBankAccountResponse from(TeacherBankAccount account, String teacherName) {
        return new AdminBankAccountResponse(
                account.getTeacherId(),
                teacherName,
                account.getBankName(),
                account.getAccountNumber(),
                account.getAccountHolder(),
                account.getBranch(),
                account.getVerifyStatus(),
                account.getUpdatedAt()
        );
    }
}
