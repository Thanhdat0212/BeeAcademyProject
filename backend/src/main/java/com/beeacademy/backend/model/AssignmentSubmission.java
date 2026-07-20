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

    /** Cam kết thời gian chấm theo UC16: không quá 7 ngày sau lần nộp gần nhất. */
    @Column(name = "expected_graded_by", nullable = false)
    private Instant expectedGradedBy;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Column(name = "late", nullable = false)
    private Boolean late;

    @Column(name = "late_penalty_percent", nullable = false)
    private Integer latePenaltyPercent;

    @Column(name = "raw_score")
    private Integer rawScore;

    public void grade(int score, String feedback, Profile teacher) {
        grade(score, score, 0, feedback, teacher);
    }

    public void grade(int rawScore, int finalScore, int appliedLatePenaltyPercent,
                      String feedback, Profile teacher) {
        this.rawScore = rawScore;
        this.score = finalScore;
        this.latePenaltyPercent = Math.max(0, Math.min(100, appliedLatePenaltyPercent));
        this.feedback = feedback == null || feedback.isBlank() ? null : feedback.trim();
        this.gradedBy = teacher;
        this.status = "graded";
        this.gradedAt = Instant.now();
    }

    public static AssignmentSubmission submit(Assignment assignment, Profile student,
                                              String content, String fileUrlsJson,
                                              boolean late, int latePenaltyPercent) {
        AssignmentSubmission submission = new AssignmentSubmission();
        submission.id = UUID.randomUUID();
        submission.assignment = assignment;
        submission.student = student;
        submission.attemptNumber = 1;
        submission.late = late;
        submission.latePenaltyPercent = late ? latePenaltyPercent : 0;
        submission.applyContent(content, fileUrlsJson);
        return submission;
    }

    public static AssignmentSubmission submit(Assignment assignment, Profile student,
                                               String content, String fileUrlsJson) {
        return submit(assignment, student, content, fileUrlsJson, false, 0);
    }

    public void resubmit(String content, String fileUrlsJson,
                         boolean late, int latePenaltyPercent) {
        this.attemptNumber = effectiveAttemptNumber() + 1;
        this.late = late;
        this.latePenaltyPercent = late ? latePenaltyPercent : 0;
        applyContent(content, fileUrlsJson);
        this.score = null;
        this.rawScore = null;
        this.feedback = null;
        this.gradedBy = null;
        this.gradedAt = null;
    }

    public void resubmit(String content, String fileUrlsJson) {
        resubmit(content, fileUrlsJson, false, 0);
    }

    public int effectiveAttemptNumber() {
        return attemptNumber != null && attemptNumber > 0 ? attemptNumber : 1;
    }

    public boolean isLate() {
        return Boolean.TRUE.equals(late);
    }

    public int effectiveLatePenaltyPercent() {
        return latePenaltyPercent != null
                ? Math.max(0, Math.min(100, latePenaltyPercent))
                : 0;
    }

    private void applyContent(String content, String fileUrlsJson) {
        this.content = content == null || content.isBlank() ? null : content.trim();
        this.fileUrlsJson = fileUrlsJson == null || fileUrlsJson.isBlank()
                ? "[]" : fileUrlsJson;
        this.status = "submitted";
        this.submittedAt = Instant.now();
        this.expectedGradedBy = this.submittedAt.plus(7, java.time.temporal.ChronoUnit.DAYS);
    }
}
