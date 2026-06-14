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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Cấu hình quiz cho một chương học.
 *
 * <p>Ràng buộc UNIQUE(chapter_id) đảm bảo mỗi chương chỉ có đúng 1 config.
 * GV upsert config qua {@code PUT /api/teacher/chapters/{id}/quiz-config}.
 *
 * <p>Bộ đếm {@code easyCount + mediumCount + hardCount} phải bằng
 * {@code totalQuestions} — validate tại service trước khi lưu.
 */
@Entity
@Table(name = "quiz_configs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuizConfig {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 1 chương chỉ có 1 config — UNIQUE constraint tại DB. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false)
    private Chapter chapter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Profile teacher;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "easy_count", nullable = false)
    private Integer easyCount;

    @Column(name = "medium_count", nullable = false)
    private Integer mediumCount;

    @Column(name = "hard_count", nullable = false)
    private Integer hardCount;

    /** Null = không giới hạn thời gian. */
    @Column(name = "time_limit_minutes")
    private Integer timeLimitMinutes;

    /** Điểm đạt (thang 10), vd: 6.0. */
    @Column(name = "passing_score", nullable = false, precision = 4, scale = 1)
    private BigDecimal passingScore;

    @Column(name = "shuffle_questions", nullable = false)
    private Boolean shuffleQuestions;

    @Column(name = "shuffle_choices", nullable = false)
    private Boolean shuffleChoices;

    /** Null = không giới hạn số lần làm lại. */
    @Column(name = "max_attempts")
    private Integer maxAttempts;

    /**
     * Chế độ chọn câu hỏi: "random" (mặc định) hoặc "manual".
     * - random: hệ thống random pick theo easyCount/mediumCount/hardCount
     * - manual: dùng đúng danh sách selectedQuestionIds
     */
    @Column(name = "selection_mode", nullable = false)
    private String selectionMode = "random";

    /**
     * Danh sách ID câu hỏi được chọn thủ công (chỉ dùng khi selectionMode = "manual").
     * Null khi selectionMode = "random".
     */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "selected_question_ids", columnDefinition = "uuid[]")
    private List<UUID> selectedQuestionIds;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ========================================================================
    // Factory + business methods
    // ========================================================================

    public static QuizConfig create(Chapter chapter, Profile teacher,
                                     int totalQuestions, int easyCount,
                                     int mediumCount, int hardCount,
                                     Integer timeLimitMinutes, double passingScore,
                                     boolean shuffleQuestions, boolean shuffleChoices,
                                     Integer maxAttempts,
                                     String selectionMode, List<UUID> selectedQuestionIds) {
        QuizConfig c            = new QuizConfig();
        c.id                    = UUID.randomUUID();
        c.chapter               = chapter;
        c.teacher               = teacher;
        c.totalQuestions        = totalQuestions;
        c.easyCount             = easyCount;
        c.mediumCount           = mediumCount;
        c.hardCount             = hardCount;
        c.timeLimitMinutes      = timeLimitMinutes;
        c.passingScore          = BigDecimal.valueOf(passingScore);
        c.shuffleQuestions      = shuffleQuestions;
        c.shuffleChoices        = shuffleChoices;
        c.maxAttempts           = maxAttempts;
        c.selectionMode         = selectionMode != null ? selectionMode : "random";
        c.selectedQuestionIds   = selectedQuestionIds;
        return c;
    }

    public void update(int totalQuestions, int easyCount, int mediumCount, int hardCount,
                        Integer timeLimitMinutes, double passingScore,
                        boolean shuffleQuestions, boolean shuffleChoices, Integer maxAttempts,
                        String selectionMode, List<UUID> selectedQuestionIds) {
        this.totalQuestions     = totalQuestions;
        this.easyCount          = easyCount;
        this.mediumCount        = mediumCount;
        this.hardCount          = hardCount;
        this.timeLimitMinutes   = timeLimitMinutes;
        this.passingScore       = BigDecimal.valueOf(passingScore);
        this.shuffleQuestions   = shuffleQuestions;
        this.shuffleChoices     = shuffleChoices;
        this.maxAttempts        = maxAttempts;
        this.selectionMode      = selectionMode != null ? selectionMode : "random";
        this.selectedQuestionIds = selectedQuestionIds;
    }
}
