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
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "assignment_submissions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssignmentSubmission {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @Column(name = "content")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "file_urls", nullable = false, columnDefinition = "jsonb")
    private String fileUrlsJson;

    @ColumnTransformer(read = "status::text", write = "?::submission_status")
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "score")
    private Integer score;

    @Column(name = "feedback")
    private String feedback;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "graded_by")
    private Profile gradedBy;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "graded_at")
    private Instant gradedAt;

    public void grade(int score, String feedback, Profile teacher) {
        this.score = score;
        this.feedback = feedback == null || feedback.isBlank() ? null : feedback.trim();
        this.gradedBy = teacher;
        this.status = "graded";
        this.gradedAt = Instant.now();
    }
}
