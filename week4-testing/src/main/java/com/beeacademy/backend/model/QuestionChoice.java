package com.beeacademy.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

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

    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    @Column(name = "position", nullable = false)
    private Integer position;

    public static QuestionChoice create(Question question, String content,
                                        boolean isCorrect, int position) {
        QuestionChoice c = new QuestionChoice();
        c.id = UUID.randomUUID();
        c.question = question;
        c.content = content;
        c.isCorrect = isCorrect;
        c.position = position;
        return c;
    }

    public void update(String content, boolean isCorrect) {
        this.content = content;
        this.isCorrect = isCorrect;
    }
}
