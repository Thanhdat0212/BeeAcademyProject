package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ApprovalHistory;

import java.time.Instant;
import java.util.UUID;

/** Một record lịch sử duyệt để hiển thị timeline cho GV. */
public record ApprovalHistoryResponse(
        UUID id,
        String action,      // approved | rejected | needs_revision
        String comment,
        String adminName,
        Instant createdAt
) {
    public static ApprovalHistoryResponse fromEntity(ApprovalHistory h) {
        String adminName = h.getAdmin() != null ? h.getAdmin().getFullName() : "Admin";
        return new ApprovalHistoryResponse(
                h.getId(), h.getAction(), h.getComment(), adminName, h.getCreatedAt()
        );
    }
}
