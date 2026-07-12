package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.UserNotification;

import java.time.Instant;
import java.util.UUID;

public record UserNotificationResponse(
        UUID id,
        String type,
        String title,
        String body,
        String targetUrl,
        boolean read,
        Instant createdAt,
        Instant readAt
) {
    public static UserNotificationResponse fromEntity(UserNotification notification) {
        return new UserNotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getTargetUrl(),
                notification.getReadAt() != null,
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }
}
