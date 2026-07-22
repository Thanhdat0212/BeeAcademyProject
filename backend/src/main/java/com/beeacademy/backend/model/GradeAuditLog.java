package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "grade_audit_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GradeAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "target_type", nullable = false)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(name = "grader_id", nullable = false)
    private UUID graderId;

    @Column(name = "old_score")
    private Double oldScore;

    @Column(name = "new_score", nullable = false)
    private Double newScore;

    @Column(name = "reason")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static GradeAuditLog create(String targetType, UUID targetId, UUID studentId,
                                       UUID graderId, Double oldScore, Double newScore,
                                       String reason) {
        GradeAuditLog log = new GradeAuditLog();
        log.id = UUID.randomUUID();
        log.targetType = targetType;
        log.targetId = targetId;
        log.studentId = studentId;
        log.graderId = graderId;
        log.oldScore = oldScore;
        log.newScore = newScore;
        log.reason = reason == null || reason.isBlank() ? null : reason.trim();
        return log;
    }
}
