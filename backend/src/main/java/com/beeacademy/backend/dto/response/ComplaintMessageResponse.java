package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ComplaintMessage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

public record ComplaintMessageResponse(
        UUID id,
        UUID authorId,
        String authorName,
        String authorRole,
        String content,
        Instant sentAt,
        List<ComplaintAttachmentResponse> attachments
) {
    public static ComplaintMessageResponse fromEntity(ComplaintMessage message,
                                                     Function<String, String> urlResolver) {
        String name = message.getAuthor().getFullName();
        if (name == null || name.isBlank()) {
            name = "admin".equals(message.getAuthorRole().toDbValue()) ? "Admin" : "Người dùng";
        }
        List<ComplaintAttachmentResponse> attachments = message.getAttachments().stream()
                .map(a -> ComplaintAttachmentResponse.fromEntity(a, urlResolver))
                .toList();
        return new ComplaintMessageResponse(
                message.getId(),
                message.getAuthor().getId(),
                name,
                message.getAuthorRole().toDbValue(),
                message.getContent(),
                message.getCreatedAt(),
                attachments
        );
    }
}
