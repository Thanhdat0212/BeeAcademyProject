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
            name = switch (message.getAuthorRole()) {
                case TEACHER -> "Giáo viên";
                case PARENT -> "Phụ huynh";
                case ADMIN -> "Quản trị viên";
                case STUDENT -> "Học sinh";
            };
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
