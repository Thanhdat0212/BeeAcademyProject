package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.AdminNotification;

import java.time.Instant;
import java.util.UUID;

public record AdminNotificationResponse(
        UUID id,
        String type,
        String title,
        String message,
        String targetPath,
        UUID courseId,
        String actorName,
        boolean unread,
        Instant createdAt,
        Instant readAt
) {
    public static AdminNotificationResponse fromEntity(AdminNotification notification) {
        return new AdminNotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getTargetPath(),
                notification.getCourse() != null ? notification.getCourse().getId() : null,
                notification.getActor() != null ? notification.getActor().getFullName() : null,
                notification.getReadAt() == null,
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }
}
