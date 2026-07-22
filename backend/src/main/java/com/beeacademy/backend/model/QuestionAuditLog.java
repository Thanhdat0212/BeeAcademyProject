package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "question_audit_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "question_id", nullable = false, updatable = false)
    private UUID questionId;

    @Column(name = "old_version")
    private Integer oldVersion;

    @Column(name = "new_version")
    private Integer newVersion;

    @Column(name = "action", nullable = false, updatable = false)
    private String action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_state", columnDefinition = "jsonb")
    private String oldState;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_state", columnDefinition = "jsonb")
    private String newState;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static QuestionAuditLog record(
            UUID teacherId,
            UUID questionId,
            Integer oldVersion,
            Integer newVersion,
            String action,
            String oldState,
            String newState) {
        QuestionAuditLog log = new QuestionAuditLog();
        log.id = UUID.randomUUID();
        log.teacherId = teacherId;
        log.questionId = questionId;
        log.oldVersion = oldVersion;
        log.newVersion = newVersion;
        log.action = action;
        log.oldState = oldState;
        log.newState = newState;
        return log;
    }
}
