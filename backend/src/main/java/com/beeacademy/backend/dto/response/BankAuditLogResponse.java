package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.TeacherBankAuditLog;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record BankAuditLogResponse(
    UUID id,
    Instant changedAt,
    String changedByName,
    String reason,
    String changesJson
) {
    public static BankAuditLogResponse from(TeacherBankAuditLog log) {
        return BankAuditLogResponse.builder()
                .id(log.getId())
                .changedAt(log.getChangedAt())
                .changedByName(log.getChangedByName())
                .reason(log.getReason())
                .changesJson(log.getChangesJson())
                .build();
    }
}
