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
@Table(name = "parent_link_audit_log")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ParentLinkAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "parent_id", nullable = false, updatable = false)
    private UUID parentId;

    @Column(name = "student_id", updatable = false)
    private UUID studentId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;

    @Column(name = "actor_role", nullable = false, updatable = false, length = 30)
    private String actorRole;

    @Column(name = "action", nullable = false, updatable = false, length = 80)
    private String action;

    @Column(name = "old_status", nullable = false, updatable = false, length = 30)
    private String oldStatus;

    @Column(name = "new_status", nullable = false, updatable = false, length = 30)
    private String newStatus;

    @Column(name = "operation_id", updatable = false)
    private UUID operationId;

    @Column(name = "reason", updatable = false, length = 500)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static ParentLinkAuditLog create(ParentStudentLink link, UUID actorId, UserRole actorRole,
                                            String action, ParentStudentLinkStatus oldStatus,
                                            ParentStudentLinkStatus newStatus) {
        return create(link, actorId, actorRole, action, oldStatus, newStatus, null, null);
    }

    public static ParentLinkAuditLog create(ParentStudentLink link, UUID actorId, UserRole actorRole,
                                            String action, ParentStudentLinkStatus oldStatus,
                                            ParentStudentLinkStatus newStatus, UUID operationId,
                                            String reason) {
        ParentLinkAuditLog log = new ParentLinkAuditLog();
        log.id = UUID.randomUUID();
        log.parentId = link.getParent().getId();
        log.studentId = link.getStudent().getId();
        log.actorId = actorId;
        log.actorRole = actorRole == null ? "unknown" : actorRole.name().toLowerCase();
        log.action = trim(action, 80);
        log.oldStatus = oldStatus == null ? "unknown" : oldStatus.toApiValue();
        log.newStatus = newStatus == null ? "unknown" : newStatus.toApiValue();
        log.operationId = operationId;
        log.reason = trimOptional(reason, 500);
        log.createdAt = Instant.now();
        return log;
    }

    public static ParentLinkAuditLog createAttempt(UUID parentId, UUID actorId, UserRole actorRole, String action) {
        ParentLinkAuditLog log = new ParentLinkAuditLog();
        log.id = UUID.randomUUID();
        log.parentId = parentId;
        log.studentId = null;
        log.actorId = actorId;
        log.actorRole = actorRole == null ? "unknown" : actorRole.name().toLowerCase();
        log.action = trim(action, 80);
        log.oldStatus = "none";
        log.newStatus = "none";
        log.createdAt = Instant.now();
        return log;
    }

    private static String trim(String value, int maxLength) {
        String normalized = value == null || value.isBlank() ? "parent_link_status_changed" : value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private static String trimOptional(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
