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

    @Column(name = "student_id", nullable = false, updatable = false)
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

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static ParentLinkAuditLog create(ParentStudentLink link, UUID actorId, UserRole actorRole,
                                            String action, ParentStudentLinkStatus oldStatus,
                                            ParentStudentLinkStatus newStatus) {
        ParentLinkAuditLog log = new ParentLinkAuditLog();
        log.id = UUID.randomUUID();
        log.parentId = link.getParent().getId();
        log.studentId = link.getStudent().getId();
        log.actorId = actorId;
        log.actorRole = actorRole == null ? "unknown" : actorRole.name().toLowerCase();
        log.action = trim(action, 80);
        log.oldStatus = oldStatus == null ? "unknown" : oldStatus.toApiValue();
        log.newStatus = newStatus == null ? "unknown" : newStatus.toApiValue();
        log.createdAt = Instant.now();
        return log;
    }

    private static String trim(String value, int maxLength) {
        String normalized = value == null || value.isBlank() ? "parent_link_status_changed" : value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
