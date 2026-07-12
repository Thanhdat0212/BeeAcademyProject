package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_notifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserNotification {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private Profile recipient;

    @Column(name = "type", nullable = false, length = 80)
    private String type;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "target_url", length = 500)
    private String targetUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    public static UserNotification create(Profile recipient, String type, String title,
                                          String body, String targetUrl) {
        UserNotification notification = new UserNotification();
        notification.id = UUID.randomUUID();
        notification.recipient = recipient;
        notification.type = trimToLength(type, 80);
        notification.title = trimToLength(title, 180);
        notification.body = body == null || body.isBlank() ? "Bạn có thông báo mới." : body.trim();
        notification.targetUrl = targetUrl == null || targetUrl.isBlank() ? null : trimToLength(targetUrl, 500);
        return notification;
    }

    public void markRead() {
        if (this.readAt == null) {
            this.readAt = Instant.now();
        }
    }

    private static String trimToLength(String value, int maxLength) {
        String normalized = value == null || value.isBlank() ? "notification" : value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
