package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "exam_retake_requests")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamRetakeRequest {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ExamRetakeStatus status;

    @Column(name = "requested_reason", nullable = false)
    private String requestedReason;

    @Column(name = "extra_attempts")
    private Integer extraAttempts;

    @Column(name = "decided_by")
    private UUID decidedBy;

    @Column(name = "approver_role")
    private String approverRole;

    @Column(name = "decided_reason")
    private String decidedReason;

    @Column(name = "retake_expire_at")
    private Instant retakeExpireAt;

    @Column(name = "request_count", nullable = false)
    private Integer requestCount = 1;

    @Column(name = "approval_count", nullable = false)
    private Integer approvalCount = 0;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "cooldown_until")
    private Instant cooldownUntil;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    public static ExamRetakeRequest create(Profile student, ExamConfig examConfig, String reason,
                                           int requestCount, int approvalCount) {
        ExamRetakeRequest request = new ExamRetakeRequest();
        request.id = UUID.randomUUID();
        request.student = student;
        request.examConfig = examConfig;
        request.status = ExamRetakeStatus.PENDING;
        request.requestedReason = reason;
        request.requestCount = requestCount;
        request.approvalCount = approvalCount;
        return request;
    }

    public void approve(UUID adminOrTeacherId, String approverRole, int extraAttempts,
                        String reason, Instant retakeExpireAt, int approvalCount) {
        this.status = ExamRetakeStatus.APPROVED;
        this.decidedBy = adminOrTeacherId;
        this.approverRole = approverRole;
        this.extraAttempts = extraAttempts;
        this.decidedReason = reason;
        this.retakeExpireAt = retakeExpireAt;
        this.approvalCount = approvalCount;
        this.decidedAt = Instant.now();
    }

    public void reject(UUID adminOrTeacherId, String approverRole, String reason, Instant cooldownUntil) {
        this.status = ExamRetakeStatus.REJECTED;
        this.decidedBy = adminOrTeacherId;
        this.approverRole = approverRole;
        this.decidedReason = reason;
        this.rejectedAt = Instant.now();
        this.cooldownUntil = cooldownUntil;
        this.decidedAt = Instant.now();
    }

    /** Lượt duyệt đã hết hạn (quá retakeExpireAt) mà học sinh chưa dùng hết/chưa PASSED. */
    public void expire() {
        this.status = ExamRetakeStatus.EXPIRED;
    }
}
