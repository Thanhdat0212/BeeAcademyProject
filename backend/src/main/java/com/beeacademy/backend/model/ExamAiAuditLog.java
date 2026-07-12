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
@Table(name = "exam_ai_audit_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamAiAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "prompt_id", nullable = false, updatable = false)
    private UUID promptId;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(name = "action", nullable = false, updatable = false)
    private String action;

    @Column(name = "prompt", nullable = false, updatable = false)
    private String prompt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_refs", nullable = false, updatable = false, columnDefinition = "jsonb")
    private String sourceRefsJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static ExamAiAuditLog create(UUID promptId, UUID teacherId, UUID courseId,
                                        String action, String prompt, String sourceRefsJson) {
        ExamAiAuditLog log = new ExamAiAuditLog();
        log.id = UUID.randomUUID();
        log.promptId = promptId;
        log.teacherId = teacherId;
        log.courseId = courseId;
        log.action = action;
        log.prompt = prompt;
        log.sourceRefsJson = sourceRefsJson;
        return log;
    }
}
