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

/**
 * Một lượt làm quiz của học sinh.
 *
 * <p><b>Trường {@code questionsSnapshot}</b> (JSONB) lưu toàn bộ câu hỏi
 * + đáp án đúng tại thời điểm bắt đầu làm bài. Đây là <em>nguồn sự thật
 * duy nhất</em> để chấm điểm — không bao giờ query lại bảng {@code questions}
 * khi grade. GV có thể sửa/xóa câu hỏi sau mà không ảnh hưởng bài đã làm.
 *
 * <p><b>Trường {@code answers}</b> (JSONB) lưu câu trả lời của học sinh theo
 * dạng JSON: {@code {"questionId": "choiceId", ...}}.
 *
 * <p>Cả hai field đều dùng kiểu {@code String} + {@code @JdbcTypeCode(JSON)}
 * để Hibernate tự bind JSONB. Service serialize/deserialize bằng Jackson.
 */
@Entity
@Table(name = "quiz_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuizAttempt {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_config_id", nullable = false)
    private QuizConfig quizConfig;

    /**
     * Snapshot JSON của câu hỏi + đáp án đúng tại thời điểm bắt đầu.
     * Format: JSON string được lưu như JSONB trong Postgres.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "questions_snapshot", nullable = false, columnDefinition = "jsonb")
    private String questionsSnapshot;

    /**
     * Câu trả lời của học sinh: {"questionId": "choiceId"}.
     * Null trước khi nộp bài.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", columnDefinition = "jsonb")
    private String answers;

    /** Điểm số (thang 10). Null trước khi nộp. */
    @Column(name = "score", precision = 4, scale = 1)
    private BigDecimal score;

    /** Đạt hay không đạt. Null trước khi nộp. */
    @Column(name = "passed")
    private Boolean passed;

    /** Lần thứ mấy (1, 2, 3...). */
    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    // ========================================================================
    // Factory + business methods
    // ========================================================================

    /** Tạo attempt mới khi học sinh bắt đầu làm bài. */
    public static QuizAttempt start(Profile student, QuizConfig config,
                                     String questionsSnapshotJson, int attemptNumber) {
        QuizAttempt a       = new QuizAttempt();
        a.id                = UUID.randomUUID();
        a.student           = student;
        a.quizConfig        = config;
        a.questionsSnapshot = questionsSnapshotJson;
        a.attemptNumber     = attemptNumber;
        return a;
    }

    /**
     * Nộp bài — ghi nhận đáp án, điểm và trạng thái đạt/không đạt.
     *
     * @param answersJson JSON string của đáp án học sinh
     * @param score       điểm số (0.0 – 10.0)
     * @param passed      true nếu score >= passingScore
     */
    public void submit(String answersJson, double score, boolean passed) {
        this.answers     = answersJson;
        this.score       = BigDecimal.valueOf(score).setScale(1, java.math.RoundingMode.HALF_UP);
        this.passed      = passed;
        this.submittedAt = Instant.now();
    }
}
