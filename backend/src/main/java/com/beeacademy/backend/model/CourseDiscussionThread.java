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
        CourseDiscussionThread thread = new CourseDiscussionThread();
        thread.id = UUID.randomUUID();
        thread.course = course;
        thread.lesson = lesson;
        thread.author = author;
        thread.content = content.trim();
        thread.lastActivityAt = Instant.now();
        return thread;
    }

    public List<CourseDiscussionReply> getReplies() {
        return Collections.unmodifiableList(replies);
    }

    public void addReply(Profile author, String content) {
        replies.add(CourseDiscussionReply.create(this, author, content));
        lastActivityAt = Instant.now();
    }
}
