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

    @Column(name = "title", length = 180)
    private String title;

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

    @Column(name = "visibility", nullable = false, length = 16)
    private String visibility = "public";

    @Column(name = "duplicate_of_thread_id")
    private UUID duplicateOfThreadId;

    @Column(name = "duplicate_marked_at")
    private Instant duplicateMarkedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "thread", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<QaMessage> messages = new ArrayList<>();

    public static QaThread create(Profile student, Course course, Lesson lesson, String content) {
        return createWithAuthor(student, course, lesson, student, content);
    }

    public static QaThread create(Profile student, Course course, Lesson lesson, String content,
                                  String attachmentUrl, String attachmentName,
                                  String attachmentType, Long attachmentSizeBytes) {
        return createWithAuthor(student, course, lesson, student, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes, "public");
    }

    public static QaThread create(Profile student, Course course, Lesson lesson, String content,
                                  String attachmentUrl, String attachmentName,
                                  String attachmentType, Long attachmentSizeBytes,
                                  String visibility) {
        return createWithAuthor(student, course, lesson, student, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes, visibility);
    }

    public static QaThread createStudentQuestion(Profile student, Course course, Lesson lesson,
                                                 String title, String content,
                                                 String attachmentUrl, String attachmentName,
                                                 String attachmentType, Long attachmentSizeBytes,
                                                 String visibility) {
        QaThread thread = createWithAuthor(student, course, lesson, student, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes, visibility);
        thread.title = title;
        return thread;
    }

    public static QaThread createWithAuthor(Profile student, Course course, Lesson lesson,
                                            Profile author, String content) {
        return createWithAuthor(student, course, lesson, author, content, null, null, null, null);
    }

    public static QaThread createWithAuthor(Profile student, Course course, Lesson lesson,
                                            Profile author, String content,
                                            String attachmentUrl, String attachmentName,
                                            String attachmentType, Long attachmentSizeBytes) {
        return createWithAuthor(student, course, lesson, author, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes, "public");
    }

    public static QaThread createWithAuthor(Profile student, Course course, Lesson lesson,
                                            Profile author, String content,
                                            String attachmentUrl, String attachmentName,
                                            String attachmentType, Long attachmentSizeBytes,
                                            String visibility) {
        QaThread thread = new QaThread();
        thread.id = UUID.randomUUID();
        thread.student = student;
        thread.course = course;
        thread.lesson = lesson;
        thread.visibility = normalizeVisibility(visibility);
        thread.status = QaThreadStatus.PENDING;
        thread.lastActivityAt = Instant.now();
        thread.messages.add(QaMessage.create(thread, author, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes));
        return thread;
    }

    public List<QaMessage> getMessages() {
        return Collections.unmodifiableList(messages);
    }

    public void addStudentMessage(Profile student, String content) {
        addStudentMessage(student, content, null, null, null, null);
    }

    public void addStudentMessage(Profile student, String content,
                                  String attachmentUrl, String attachmentName,
                                  String attachmentType, Long attachmentSizeBytes) {
        this.messages.add(QaMessage.create(this, student, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes));
        this.status = QaThreadStatus.PENDING;
        this.resolvedAt = null;
        this.lastActivityAt = Instant.now();
    }

    public void addParentMessage(Profile parent, String content) {
        addParentMessage(parent, content, null, null, null, null);
    }

    public void addParentMessage(Profile parent, String content,
                                 String attachmentUrl, String attachmentName,
                                 String attachmentType, Long attachmentSizeBytes) {
        this.messages.add(QaMessage.create(this, parent, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes));
        this.status = QaThreadStatus.PENDING;
        this.resolvedAt = null;
        this.lastActivityAt = Instant.now();
    }

    public void addTeacherMessage(Profile teacher, String content) {
        addTeacherMessage(teacher, content, null, null, null, null);
    }

    public void addTeacherMessage(Profile teacher, String content,
                                  String attachmentUrl, String attachmentName,
                                  String attachmentType, Long attachmentSizeBytes) {
        this.messages.add(QaMessage.create(this, teacher, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes));
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
        this.duplicateOfThreadId = null;
        this.duplicateMarkedAt = null;
        this.lastActivityAt = Instant.now();
    }

    public void markDuplicate(UUID duplicateOfThreadId) {
        this.duplicateOfThreadId = duplicateOfThreadId;
        this.duplicateMarkedAt = Instant.now();
        this.status = QaThreadStatus.RESOLVED;
        this.resolvedAt = Instant.now();
        this.lastActivityAt = Instant.now();
    }

    private static String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "public";
        }
        String normalized = visibility.trim().toLowerCase();
        return "private".equals(normalized) ? "private" : "public";
    }
}
