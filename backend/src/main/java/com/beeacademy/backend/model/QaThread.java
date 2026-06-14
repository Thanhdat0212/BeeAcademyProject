package com.beeacademy.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "qa_threads")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QaThread {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    @Convert(converter = QaThreadStatusConverter.class)
    @Column(name = "status", nullable = false)
    private QaThreadStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "thread", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<QaMessage> messages = new ArrayList<>();

    public static QaThread create(Profile student, Course course, Lesson lesson, String content) {
        QaThread thread = new QaThread();
        thread.id = UUID.randomUUID();
        thread.student = student;
        thread.course = course;
        thread.lesson = lesson;
        thread.status = QaThreadStatus.PENDING;
        thread.lastActivityAt = Instant.now();
        thread.messages.add(QaMessage.create(thread, student, content));
        return thread;
    }

    public List<QaMessage> getMessages() {
        return Collections.unmodifiableList(messages);
    }

    public void addStudentMessage(Profile student, String content) {
        this.messages.add(QaMessage.create(this, student, content));
        this.status = QaThreadStatus.PENDING;
        this.resolvedAt = null;
        this.lastActivityAt = Instant.now();
    }

    public void addTeacherMessage(Profile teacher, String content) {
        this.messages.add(QaMessage.create(this, teacher, content));
        this.status = QaThreadStatus.ANSWERED;
        this.resolvedAt = null;
        this.lastActivityAt = Instant.now();
    }

    public void resolve() {
        this.status = QaThreadStatus.RESOLVED;
        this.resolvedAt = Instant.now();
        this.lastActivityAt = Instant.now();
    }

    public void reopen() {
        boolean hasTeacherReply = messages.stream()
                .anyMatch(m -> m.getAuthorRole() == UserRole.TEACHER);
        this.status = hasTeacherReply ? QaThreadStatus.ANSWERED : QaThreadStatus.PENDING;
        this.resolvedAt = null;
        this.lastActivityAt = Instant.now();
    }
}
