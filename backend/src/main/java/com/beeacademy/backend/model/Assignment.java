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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "assignments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Assignment {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id")
    private Chapter chapter;

    @Column(nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "max_score", nullable = false)
    private Integer maxScore;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts;

    @Column(name = "allow_late_submission", nullable = false)
    private Boolean allowLateSubmission;

    @Column(name = "late_penalty_percent", nullable = false)
    private Integer latePenaltyPercent;

    @Column(name = "accepting_submissions", nullable = false)
    private Boolean acceptingSubmissions;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Course getCourse() {
        if (chapter != null) return chapter.getCourse();
        if (lesson != null && lesson.getChapter() != null) {
            return lesson.getChapter().getCourse();
        }
        return null;
    }

    public static Assignment create(Chapter chapter, Lesson lesson, String title,
                                    String description, Integer maxScore, Instant dueAt,
                                    Integer maxAttempts, Boolean allowLateSubmission,
                                    Integer latePenaltyPercent, Boolean acceptingSubmissions) {
        Assignment assignment = new Assignment();
        assignment.id = UUID.randomUUID();
        assignment.chapter = chapter;
        assignment.lesson = lesson;
        assignment.title = title.trim();
        assignment.description = description == null || description.isBlank()
                ? null : description.trim();
        assignment.maxScore = maxScore;
        assignment.dueAt = dueAt;
        assignment.updateSubmissionPolicy(
                dueAt, maxAttempts, allowLateSubmission,
                latePenaltyPercent, acceptingSubmissions);
        return assignment;
    }

    /** Backward-compatible factory for callers that do not configure UC16 policy. */
    public static Assignment create(Chapter chapter, Lesson lesson, String title,
                                    String description, Integer maxScore, Instant dueAt) {
        return create(chapter, lesson, title, description, maxScore, dueAt,
                3, false, 0, true);
    }

    public void updateSubmissionPolicy(
            Instant dueAt,
            Integer maxAttempts,
            Boolean allowLateSubmission,
            Integer latePenaltyPercent,
            Boolean acceptingSubmissions) {
        if (dueAt != null) this.dueAt = dueAt;
        if (maxAttempts != null) this.maxAttempts = Math.max(1, maxAttempts);
        if (allowLateSubmission != null) this.allowLateSubmission = allowLateSubmission;
        if (latePenaltyPercent != null) {
            this.latePenaltyPercent = Math.max(0, Math.min(100, latePenaltyPercent));
        }
        if (acceptingSubmissions != null) this.acceptingSubmissions = acceptingSubmissions;
    }

    public int effectiveMaxAttempts() {
        return maxAttempts != null && maxAttempts > 0 ? maxAttempts : 3;
    }

    public boolean permitsLateSubmission() {
        return Boolean.TRUE.equals(allowLateSubmission);
    }

    public int effectiveLatePenaltyPercent() {
        return latePenaltyPercent != null
                ? Math.max(0, Math.min(100, latePenaltyPercent))
                : 0;
    }

    public boolean isAcceptingSubmissions() {
        return acceptingSubmissions == null || acceptingSubmissions;
    }
}
