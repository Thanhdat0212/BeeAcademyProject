package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * H2-adapted: bo tat ca @ColumnTransformer (PostgreSQL cast syntax).
 * difficulty, type, status luu nhu VARCHAR thong thuong trong H2.
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "grade", nullable = false)
    private Integer grade;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id")
    private Chapter chapter;

    @Column(name = "content", nullable = false)
    private String content;

    @Column(name = "explanation")
    private String explanation;

    // H2-adapted: bo @ColumnTransformer, luu nhu VARCHAR
    @Column(name = "difficulty", nullable = false)
    private String difficulty;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "usage_count", nullable = false)
    private Integer usageCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @BatchSize(size = 50)
    @OneToMany(mappedBy = "question", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<QuestionChoice> choices = new ArrayList<>();

    public List<QuestionChoice> getChoices() {
        return Collections.unmodifiableList(choices);
    }

    public static Question create(Profile teacher, Category category, Integer grade, Chapter chapter,
                                  String content, String explanation, String difficulty, String type) {
        Question q = new Question();
        q.id = UUID.randomUUID();
        q.teacher = teacher;
        q.category = category;
        q.grade = grade;
        q.chapter = chapter;
        q.content = content;
        q.explanation = explanation;
        q.difficulty = difficulty;
        q.type = type;
        q.status = "active";
        q.usageCount = 0;
        return q;
    }

    public void update(Category category, Integer grade, Chapter chapter,
                       String content, String explanation, String difficulty) {
        if (category != null) this.category = category;
        if (grade != null) this.grade = grade;
        this.chapter = chapter;
        if (content != null && !content.isBlank()) this.content = content;
        if (explanation != null) this.explanation = explanation;
        if (difficulty != null) this.difficulty = difficulty;
    }

    public void deactivate() { this.status = "inactive"; }

    public void incrementUsage() { this.usageCount++; }

    public void addChoice(QuestionChoice choice) { this.choices.add(choice); }

    public void clearChoices() { this.choices.clear(); }
}
