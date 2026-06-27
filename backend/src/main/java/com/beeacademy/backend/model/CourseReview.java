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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static CourseReview create(Course course, Profile student, int rating, String comment) {
        CourseReview review = new CourseReview();
        review.id = UUID.randomUUID();
        review.course = course;
        review.student = student;
        review.rating = rating;
        review.comment = normalizeComment(comment);
        return review;
    }

    public void update(int rating, String comment) {
        this.rating = rating;
        this.comment = normalizeComment(comment);
    }

    private static String normalizeComment(String comment) {
        if (comment == null) return null;
        String trimmed = comment.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
