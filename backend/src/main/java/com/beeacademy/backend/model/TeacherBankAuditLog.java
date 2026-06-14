package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "teacher_bank_audit_log")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TeacherBankAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    @Column(name = "changed_by_name")
    private String changedByName;

    @Column(name = "reason")
    private String reason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "changes", nullable = false, columnDefinition = "jsonb")
    private String changesJson;

    public static TeacherBankAuditLog create(UUID teacherId, String changedByName,
                                              String reason, String changesJson) {
        TeacherBankAuditLog log = new TeacherBankAuditLog();
        log.id = UUID.randomUUID();
        log.teacherId = teacherId;
        log.changedAt = Instant.now();
        log.changedByName = changedByName;
        log.reason = (reason != null && !reason.isBlank()) ? reason.trim() : null;
        log.changesJson = changesJson;
        return log;
    }
}
