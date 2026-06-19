package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Complaint;

import java.time.Instant;
import java.util.UUID;

/**
 * Tóm tắt khiếu nại (KHÔNG kèm thread) — dùng cho danh sách panel trái của
 * Admin inbox. Tránh load collection messages khi phân trang → không N+1,
 * không cảnh báo "collection fetch + pagination" của Hibernate.
 */
public record ComplaintSummaryResponse(
        UUID id,
        UUID senderId,
        String senderName,
        String senderRole,
        String title,
        String category,
        String priority,
        String status,
        Instant createdAt,
        Instant lastActivityAt
) {
    public static ComplaintSummaryResponse fromEntity(Complaint c) {
        String senderName = c.getSender().getFullName();
        if (senderName == null || senderName.isBlank()) {
            senderName = "Người dùng";
        }
        return new ComplaintSummaryResponse(
                c.getId(),
                c.getSender().getId(),
                senderName,
                c.getSenderRole().toDbValue(),
                c.getTitle(),
                c.getCategory(),
                c.getPriority(),
                c.getStatus().toDbValue(),
                c.getCreatedAt(),
                c.getLastActivityAt()
        );
    }
}
