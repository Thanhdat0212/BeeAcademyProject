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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_lesson_notes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudentLessonNote {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false, updatable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false, updatable = false)
    private Lesson lesson;

    @Column(name = "time_sec", nullable = false)
    private Integer timeSec;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static StudentLessonNote create(Profile student, Lesson lesson,
                                           int timeSec, String content) {
        StudentLessonNote note = new StudentLessonNote();
        note.id = UUID.randomUUID();
        note.student = student;
        note.lesson = lesson;
        note.update(timeSec, content);
        return note;
    }

    public void update(int timeSec, String content) {
        if (timeSec < 0) {
            throw new IllegalArgumentException("timeSec không được âm");
        }
        String normalized = content == null ? "" : content.trim();
        if (normalized.isEmpty() || normalized.length() > 2000) {
            throw new IllegalArgumentException("Nội dung ghi chú không hợp lệ");
        }
        this.timeSec = timeSec;
        this.content = normalized;
    }
}
