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
@Table(name = "course_version_migration_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseVersionMigrationLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "enrollment_id", nullable = false, updatable = false)
    private UUID enrollmentId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(name = "from_version_id", nullable = false, updatable = false)
    private UUID fromVersionId;

    @Column(name = "to_version_id", nullable = false, updatable = false)
    private UUID toVersionId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;

    @Column(name = "reason", nullable = false, length = 1000, updatable = false)
    private String reason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "progress_mapping", nullable = false, columnDefinition = "jsonb", updatable = false)
    private String progressMappingJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "final_exam_mapping", nullable = false, columnDefinition = "jsonb", updatable = false)
    private String finalExamMappingJson;

    @Column(name = "certificate_mapping", nullable = false, length = 1000, updatable = false)
    private String certificateMapping;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static CourseVersionMigrationLog create(
            Enrollment enrollment,
            UUID fromVersionId,
            UUID toVersionId,
            UUID actorId,
            String reason,
            String progressMappingJson,
            String finalExamMappingJson,
            String certificateMapping) {
        CourseVersionMigrationLog log = new CourseVersionMigrationLog();
        log.id = UUID.randomUUID();
        log.enrollmentId = enrollment.getId();
        log.courseId = enrollment.getCourseId();
        log.fromVersionId = fromVersionId;
        log.toVersionId = toVersionId;
        log.actorId = actorId;
        log.reason = reason;
        log.progressMappingJson = progressMappingJson;
        log.finalExamMappingJson = finalExamMappingJson;
        log.certificateMapping = certificateMapping;
        return log;
    }
}
