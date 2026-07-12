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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "course_discussion_threads")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseDiscussionThread {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Profile author;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_url")
    private String attachmentUrl;

    @Column(name = "attachment_name")
    private String attachmentName;

    @Column(name = "attachment_type")
    private String attachmentType;

    @Column(name = "attachment_size_bytes")
    private Long attachmentSizeBytes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @OneToMany(mappedBy = "thread", fetch = FetchType.LAZY,
            cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<CourseDiscussionReply> replies = new ArrayList<>();

    public static CourseDiscussionThread create(Course course, Lesson lesson,
                                                Profile author, String content) {
        return create(course, lesson, author, content, null, null, null, null);
    }

    public static CourseDiscussionThread create(Course course, Lesson lesson,
                                                Profile author, String content,
                                                String attachmentUrl, String attachmentName,
                                                String attachmentType, Long attachmentSizeBytes) {
        CourseDiscussionThread thread = new CourseDiscussionThread();
        thread.id = UUID.randomUUID();
        thread.course = course;
        thread.lesson = lesson;
        thread.author = author;
        thread.content = content.trim();
        thread.attachmentUrl = blankToNull(attachmentUrl);
        thread.attachmentName = blankToNull(attachmentName);
        thread.attachmentType = blankToNull(attachmentType);
        thread.attachmentSizeBytes = attachmentSizeBytes;
        thread.lastActivityAt = Instant.now();
        return thread;
    }

    public List<CourseDiscussionReply> getReplies() {
        return Collections.unmodifiableList(replies);
    }

    public void addReply(Profile author, String content) {
        addReply(author, content, null, null, null, null);
    }

    public void addReply(Profile author, String content,
                         String attachmentUrl, String attachmentName,
                         String attachmentType, Long attachmentSizeBytes) {
        replies.add(CourseDiscussionReply.create(this, author, content,
                attachmentUrl, attachmentName, attachmentType, attachmentSizeBytes));
        lastActivityAt = Instant.now();
    }

    public void updateContent(String content) {
        this.content = content.trim();
        lastActivityAt = Instant.now();
    }

    public CourseDiscussionReply findReply(UUID replyId) {
        return replies.stream()
                .filter(reply -> reply.getId().equals(replyId))
                .findFirst()
                .orElse(null);
    }

    public void removeReply(CourseDiscussionReply reply) {
        replies.remove(reply);
        lastActivityAt = Instant.now();
    }

    public void touchLastActivity() {
        lastActivityAt = Instant.now();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
