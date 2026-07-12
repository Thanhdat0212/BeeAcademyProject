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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "course_reviews")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseReview {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "comment")
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 32)
    private CourseReviewModerationStatus moderationStatus;

    @Column(name = "moderation_reason", length = 500)
    private String moderationReason;

    @Column(name = "moderated_at")
    private Instant moderatedAt;

    @Column(name = "moderated_by")
    private UUID moderatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static CourseReview create(Course course, Profile student, int rating, String comment,
                                      CourseReviewModerationStatus moderationStatus) {
        CourseReview review = new CourseReview();
        review.id = UUID.randomUUID();
        review.course = course;
        review.student = student;
        review.rating = rating;
        review.comment = normalizeComment(comment);
        review.moderationStatus = moderationStatus;
        return review;
    }

    public void update(int rating, String comment, CourseReviewModerationStatus moderationStatus) {
        this.rating = rating;
        this.comment = normalizeComment(comment);
        this.moderationStatus = moderationStatus;
        this.moderationReason = null;
        this.moderatedAt = null;
        this.moderatedBy = null;
    }

    public void moderate(CourseReviewModerationStatus status, String reason, UUID moderatorId) {
        if (status != CourseReviewModerationStatus.PUBLISHED
                && status != CourseReviewModerationStatus.REJECTED) {
            throw new IllegalArgumentException("Moderation status is invalid");
        }
        this.moderationStatus = status;
        this.moderationReason = normalizeReason(reason);
        this.moderatedAt = Instant.now();
        this.moderatedBy = moderatorId;
    }

    private static String normalizeComment(String comment) {
        if (comment == null) return null;
        String trimmed = comment.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeReason(String reason) {
        if (reason == null) return null;
        String trimmed = reason.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() <= 500 ? trimmed : trimmed.substring(0, 500);
    }
}
