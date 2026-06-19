package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ComplaintMessage;

import java.time.Instant;
import java.util.UUID;

public record ComplaintMessageResponse(
        UUID id,
        UUID authorId,
        String authorName,
        String authorRole,
        String content,
        Instant sentAt
) {
    public static ComplaintMessageResponse fromEntity(ComplaintMessage message) {
        String name = message.getAuthor().getFullName();
        if (name == null || name.isBlank()) {
            name = "admin".equals(message.getAuthorRole().toDbValue()) ? "Admin" : "Người dùng";
        }
        return new ComplaintMessageResponse(
                message.getId(),
                message.getAuthor().getId(),
                name,
                message.getAuthorRole().toDbValue(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
