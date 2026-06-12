package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QaMessage;

import java.time.Instant;
import java.util.UUID;

public record QaMessageResponse(
        UUID id,
        UUID authorId,
        String authorName,
        String authorRole,
        String content,
        Instant sentAt
) {
    public static QaMessageResponse fromEntity(QaMessage message) {
        String name = message.getAuthor().getFullName();
        if (name == null || name.isBlank()) {
            name = message.getAuthorRole().toDbValue().equals("teacher")
                    ? "Giáo viên"
                    : "Học sinh";
        }
        return new QaMessageResponse(
                message.getId(),
                message.getAuthor().getId(),
                name,
                message.getAuthorRole().toDbValue(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
