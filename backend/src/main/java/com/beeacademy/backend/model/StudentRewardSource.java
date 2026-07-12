package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_reward_sources")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudentRewardSource {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "assessment_type", nullable = false, updatable = false)
    private RewardAssessmentType assessmentType;

    @Column(name = "assessment_id", nullable = false, updatable = false)
    private UUID assessmentId;

    @Column(name = "best_score_percent", nullable = false, precision = 5, scale = 1)
    private BigDecimal bestScorePercent;

    @Column(name = "awarded_points", nullable = false)
    private Integer awardedPoints;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static StudentRewardSource create(
            UUID studentId,
            RewardAssessmentType assessmentType,
            UUID assessmentId,
            double scorePercent,
            int awardedPoints) {
        StudentRewardSource source = new StudentRewardSource();
        source.id = UUID.randomUUID();
        source.studentId = studentId;
        source.assessmentType = assessmentType;
        source.assessmentId = assessmentId;
        source.bestScorePercent = normalizeScore(scorePercent);
        source.awardedPoints = awardedPoints;
        source.updatedAt = Instant.now();
        return source;
    }

    public int updateIfHigher(double scorePercent, int points) {
        if (points <= this.awardedPoints) {
            return 0;
        }
        int delta = points - this.awardedPoints;
        this.bestScorePercent = normalizeScore(scorePercent);
        this.awardedPoints = points;
        this.updatedAt = Instant.now();
        return delta;
    }

    private static BigDecimal normalizeScore(double scorePercent) {
        return BigDecimal.valueOf(scorePercent).setScale(1, RoundingMode.HALF_UP);
    }
}
