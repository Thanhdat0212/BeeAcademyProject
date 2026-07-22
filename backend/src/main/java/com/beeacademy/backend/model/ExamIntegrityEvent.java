package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "exam_integrity_events",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_exam_integrity_attempt_client_event",
                        columnNames = {"attempt_id", "client_event_id"}),
                @UniqueConstraint(
                        name = "uk_exam_integrity_attempt_count",
                        columnNames = {"attempt_id", "violation_count"})
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamIntegrityEvent {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "client_event_id", nullable = false, updatable = false)
    private UUID clientEventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enrollment_id", nullable = false, updatable = false)
    private Enrollment enrollment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false, updatable = false)
    private ExamConfig examConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false, updatable = false)
    private ExamAttempt attempt;

    @Column(name = "event_type", nullable = false, length = 32, updatable = false)
    private String eventType;

    @Column(name = "violation_count", nullable = false, updatable = false)
    private Integer violationCount;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    public static ExamIntegrityEvent record(
            UUID clientEventId,
            Enrollment enrollment,
            ExamConfig examConfig,
            ExamAttempt attempt,
            String eventType,
            int violationCount) {
        ExamIntegrityEvent event = new ExamIntegrityEvent();
        event.id = UUID.randomUUID();
        event.clientEventId = clientEventId;
        event.enrollment = enrollment;
        event.examConfig = examConfig;
        event.attempt = attempt;
        event.eventType = eventType;
        event.violationCount = violationCount;
        event.occurredAt = Instant.now();
        return event;
    }
}
