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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "question_banks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionBank {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Profile teacher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "grade", nullable = false)
    private Integer grade;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @ColumnTransformer(read = "status::text", write = "?::question_bank_status")
    @Column(name = "status", nullable = false)
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static QuestionBank create(Profile teacher, Category category, Integer grade,
                                      String title, String description) {
        QuestionBank bank = new QuestionBank();
        bank.id = UUID.randomUUID();
        bank.teacher = teacher;
        bank.category = category;
        bank.grade = grade;
        bank.title = title.trim();
        bank.description = description != null && !description.isBlank() ? description.trim() : null;
        bank.status = "active";
        return bank;
    }

    public void update(Category category, Integer grade, String title, String description) {
        this.category = category;
        this.grade = grade;
        this.title = title.trim();
        this.description = description != null && !description.isBlank()
                ? description.trim()
                : null;
    }

    public void activate() {
        this.status = "active";
    }

    public void deactivate() {
        this.status = "inactive";
    }
}
