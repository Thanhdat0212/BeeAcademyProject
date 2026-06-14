package com.beeacademy.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

import java.util.UUID;

/**
 * Một lựa chọn (A/B/C/D) của câu hỏi trắc nghiệm.
 *
 * <p>Với {@code multiple_choice}: 4 choices, 1 đáp án đúng.
 * Với {@code true_false}: 2 choices (Đúng/Sai), 1 đáp án đúng.
 *
 * <p>{@code isCorrect = true} chỉ lưu phía server — KHÔNG trả về cho FE
 * khi học sinh đang làm bài. Chỉ trả trong {@code questions_snapshot}
 * (JSONB trong quiz_attempts) để chấm điểm.
 */
@Entity
@Table(name = "question_choices")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionChoice {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    @JsonIgnore
    private Question question;

    @Column(name = "content", nullable = false)
    private String content;

    /** Chỉ 1 choice có isCorrect=true trong cùng 1 câu hỏi. */
    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    /** Thứ tự hiển thị: 1=A, 2=B, 3=C, 4=D. */
    @Column(name = "position", nullable = false)
    private Integer position;

    public static QuestionChoice create(Question question, String content,
                                         boolean isCorrect, int position) {
        QuestionChoice c = new QuestionChoice();
        c.id        = UUID.randomUUID();
        c.question  = question;
        c.content   = content;
        c.isCorrect = isCorrect;
        c.position  = position;
        return c;
    }

    public void update(String content, boolean isCorrect) {
        this.content   = content;
        this.isCorrect = isCorrect;
    }
}
