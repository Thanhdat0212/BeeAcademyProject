package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exam_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamAttempt {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "questions_snapshot", nullable = false, columnDefinition = "jsonb")
    private String questionsSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", columnDefinition = "jsonb")
    private String answers;

    @Column(name = "score_percent", precision = 5, scale = 1)
    private BigDecimal scorePercent;

    @Column(name = "manual_score_percent", precision = 5, scale = 1)
    private BigDecimal manualScorePercent;

    @Column(name = "teacher_feedback")
    private String teacherFeedback;

    @Column(name = "graded_at")
    private Instant gradedAt;

    @Column(name = "passed")
    private Boolean passed;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    public static ExamAttempt start(Profile student, ExamConfig config,
                                    String questionsSnapshotJson, int attemptNumber) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.id = UUID.randomUUID();
        attempt.student = student;
        attempt.examConfig = config;
        attempt.questionsSnapshot = questionsSnapshotJson;
        attempt.attemptNumber = attemptNumber;
        return attempt;
    }

    public void submit(String answersJson, double scorePercent, boolean passed) {
        this.answers = answersJson;
        this.scorePercent = BigDecimal.valueOf(scorePercent)
                .setScale(1, java.math.RoundingMode.HALF_UP);
        this.passed = passed;
        this.submittedAt = Instant.now();
    }

    public void grade(double scorePercent, String feedback) {
        this.manualScorePercent = BigDecimal.valueOf(scorePercent)
                .setScale(1, java.math.RoundingMode.HALF_UP);
        this.teacherFeedback = feedback == null || feedback.isBlank()
                ? null
                : feedback.trim();
        this.passed = scorePercent >= examConfig.getPassScorePercent();
        this.gradedAt = Instant.now();
    }

    public BigDecimal getEffectiveScorePercent() {
        return manualScorePercent != null ? manualScorePercent : scorePercent;
    }
}
