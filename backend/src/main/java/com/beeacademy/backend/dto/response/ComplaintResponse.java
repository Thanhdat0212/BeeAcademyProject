package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Complaint;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Khiếu nại đầy đủ kèm toàn bộ thread tin nhắn — dùng cho màn chi tiết
 * (panel phải của Admin inbox và trang khiếu nại của người gửi).
 */
public record ComplaintResponse(
        UUID id,
        UUID senderId,
        String senderName,
        String senderRole,
        String title,
        String category,
        String priority,
        String status,
        Instant createdAt,
        Instant lastActivityAt,
        List<ComplaintMessageResponse> messages
) {
    public static ComplaintResponse fromEntity(Complaint c) {
        String senderName = c.getSender().getFullName();
        if (senderName == null || senderName.isBlank()) {
            senderName = "Người dùng";
        }
        List<ComplaintMessageResponse> messages = c.getMessages().stream()
                .sorted(Comparator.comparing(m -> m.getCreatedAt() == null ? Instant.EPOCH : m.getCreatedAt()))
                .map(ComplaintMessageResponse::fromEntity)
                .toList();
        return new ComplaintResponse(
                c.getId(),
                c.getSender().getId(),
                senderName,
                c.getSenderRole().toDbValue(),
                c.getTitle(),
                c.getCategory(),
                c.getPriority(),
                c.getStatus().toDbValue(),
                c.getCreatedAt(),
                c.getLastActivityAt(),
                messages
        );
    }
}
