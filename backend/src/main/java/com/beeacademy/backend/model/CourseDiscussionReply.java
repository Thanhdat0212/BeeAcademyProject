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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "course_discussion_replies")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseDiscussionReply {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id", nullable = false)
    private CourseDiscussionThread thread;

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

    static CourseDiscussionReply create(CourseDiscussionThread thread, Profile author, String content) {
        return create(thread, author, content, null, null, null, null);
    }

    static CourseDiscussionReply create(CourseDiscussionThread thread, Profile author, String content,
                                        String attachmentUrl, String attachmentName,
                                        String attachmentType, Long attachmentSizeBytes) {
        CourseDiscussionReply reply = new CourseDiscussionReply();
        reply.id = UUID.randomUUID();
        reply.thread = thread;
        reply.author = author;
        reply.content = content.trim();
        reply.attachmentUrl = blankToNull(attachmentUrl);
        reply.attachmentName = blankToNull(attachmentName);
        reply.attachmentType = blankToNull(attachmentType);
        reply.attachmentSizeBytes = attachmentSizeBytes;
        return reply;
    }

    public void updateContent(String content) {
        this.content = content.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
