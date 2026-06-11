package com.beeacademy.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Câu hỏi trong ngân hàng câu hỏi (Question Bank).
 *
 * <p>Một câu hỏi thuộc về:
 * <ul>
 *   <li>Một môn học ({@code category}) — bắt buộc.</li>
 *   <li>Một chương ({@code chapter}) — tùy chọn. Null = câu hỏi cấp môn học
 *       (dùng cho thi cuối môn). Không null = câu hỏi theo chương (dùng quiz
 *       cuối chương).</li>
 * </ul>
 *
 * <p>Trường {@code difficulty} dùng Postgres enum {@code question_difficulty}
 * với cùng pattern {@code @ColumnTransformer} như {@code CourseStatus}:
 * Java enum name lowercase → Postgres enum.
 *
 * <p>Trường {@code usageCount} tăng mỗi khi học sinh bắt đầu làm quiz có
 * chứa câu hỏi này. Dùng để thống kê và ngăn xóa câu đã được dùng.
 */
@Entity
@Table(name = "questions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Question {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Profile teacher;

    /** Môn học — bắt buộc. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    /**
     * Chương — tùy chọn. Null = câu hỏi tổng quát toàn môn.
     * Khi cấu hình quiz cho chương, chỉ lấy câu có chapter_id = chapterId.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id")
    private Chapter chapter;

    /** Nội dung đề bài — hỗ trợ Markdown + LaTeX. */
    @Column(name = "content", nullable = false)
    private String content;

    /** Giải thích đáp án — hiển thị cho học sinh sau khi nộp bài. */
    @Column(name = "explanation")
    private String explanation;

    /**
     * Độ khó: easy | medium | hard — ánh xạ Postgres enum question_difficulty.
     * Dùng TEXT thường để Hibernate không nhầm với Java enum serialization.
     */
    @ColumnTransformer(read = "difficulty::text", write = "?::question_difficulty")
    @Column(name = "difficulty", nullable = false)
    private String difficulty;

    /**
     * Loại câu hỏi: multiple_choice | true_false.
     */
    @ColumnTransformer(read = "type::text", write = "?::question_type")
    @Column(name = "type", nullable = false)
    private String type;

    /** Trạng thái: active | inactive. Dùng soft-delete để giữ lịch sử quiz. */
    @ColumnTransformer(read = "status::text", write = "?::question_status")
    @Column(name = "status", nullable = false)
    private String status;

    /** Số lần câu này đã xuất hiện trong quiz_attempts. */
    @Column(name = "usage_count", nullable = false)
    private Integer usageCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Danh sách đáp án, sắp xếp theo position.
     *
     * @BatchSize(50): khi Hibernate load choices cho N question, thay vì bắn N query lẻ
     * ("SELECT * FROM question_choices WHERE question_id = ?") nó gom thành batch:
     * "SELECT * FROM question_choices WHERE question_id IN (?, ?, ..., ?)" với tối đa 50 ID.
     * Với 200 câu hỏi: 200 queries → 4 queries. Tránh N+1 mà không cần JOIN FETCH
     * (JOIN FETCH với paginated query gây Hibernate warning HHH90003004: in-memory pagination).
     */
    @BatchSize(size = 50)
    @OneToMany(mappedBy = "question", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<QuestionChoice> choices = new ArrayList<>();

    public List<QuestionChoice> getChoices() {
        return Collections.unmodifiableList(choices);
    }

    // ========================================================================
    // Factory + business methods
    // ========================================================================

    public static Question create(Profile teacher, Category category, Chapter chapter,
                                   String content, String explanation,
                                   String difficulty, String type) {
        Question q     = new Question();
        q.id           = UUID.randomUUID();
        q.teacher      = teacher;
        q.category     = category;
        q.chapter      = chapter;
        q.content      = content;
        q.explanation  = explanation;
        q.difficulty   = difficulty;   // "easy" | "medium" | "hard"
        q.type         = type;         // "multiple_choice" | "true_false"
        q.status       = "active";
        q.usageCount   = 0;
        return q;
    }

    public void update(String content, String explanation, String difficulty) {
        if (content != null && !content.isBlank()) this.content = content;
        if (explanation != null) this.explanation = explanation;
        if (difficulty != null) this.difficulty = difficulty;
    }

    /** Soft-delete: chỉ đặt status = inactive, không xóa khỏi DB. */
    public void deactivate() {
        this.status = "inactive";
    }

    /** Tăng usage_count khi quiz attempt dùng câu này. */
    public void incrementUsage() {
        this.usageCount++;
    }

    /**
     * Thêm một lựa chọn vào câu hỏi trước khi save.
     */
    public void addChoice(QuestionChoice choice) {
        this.choices.add(choice);
    }

    /**
     * Xóa toàn bộ choices — dùng khi update câu hỏi.
     * {@code orphanRemoval=true} đảm bảo JPA DELETE các bản ghi cũ khi save.
     */
    public void clearChoices() {
        this.choices.clear();
    }
}
