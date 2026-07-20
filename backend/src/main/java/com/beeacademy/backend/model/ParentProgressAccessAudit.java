package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "parent_progress_access_audit")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ParentProgressAccessAudit {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "parent_id", nullable = false, updatable = false)
    private UUID parentId;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "action", nullable = false, updatable = false, length = 80)
    private String action;

    @Column(name = "sensitive_data_requested", nullable = false, updatable = false)
    private boolean sensitiveDataRequested;

    @Column(name = "sensitive_data_allowed", nullable = false, updatable = false)
    private boolean sensitiveDataAllowed;

    @Column(name = "reason", updatable = false, length = 255)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static ParentProgressAccessAudit create(
            UUID parentId,
            UUID studentId,
            String action,
            boolean sensitiveDataRequested,
            boolean sensitiveDataAllowed,
            String reason) {
        ParentProgressAccessAudit audit = new ParentProgressAccessAudit();
        audit.id = UUID.randomUUID();
        audit.parentId = parentId;
        audit.studentId = studentId;
        audit.action = trim(action, 80, "view_child_progress");
        audit.sensitiveDataRequested = sensitiveDataRequested;
        audit.sensitiveDataAllowed = sensitiveDataAllowed;
        audit.reason = trimNullable(reason, 255);
        audit.createdAt = Instant.now();
        return audit;
    }

    private static String trim(String value, int maxLength, String fallback) {
        String normalized = value == null || value.isBlank() ? fallback : value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private static String trimNullable(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
