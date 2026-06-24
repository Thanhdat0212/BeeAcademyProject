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
@Table(name = "admin_notifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AdminNotification {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "message", nullable = false)
    private String message;

    @Column(name = "target_path")
    private String targetPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private Profile actor;

    @Column(name = "read_at")
    private Instant readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static AdminNotification courseSubmitted(Course course, Profile teacher) {
        AdminNotification notification = new AdminNotification();
        notification.id = UUID.randomUUID();
        notification.type = "course_submitted";
        notification.title = "Khóa học mới chờ duyệt";
        notification.message = "Giáo viên "
                + displayName(teacher)
                + " đã nộp khóa học \"" + course.getTitle()
                + "\" (v" + course.getSubmittedVersionNo() + ").";
        notification.targetPath = "/admin/approvals/" + course.getId();
        notification.course = course;
        notification.actor = teacher;
        return notification;
    }

    public void markRead() {
        if (this.readAt == null) {
            this.readAt = Instant.now();
        }
    }

    private static String displayName(Profile profile) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return "giáo viên";
        }
        return profile.getFullName();
    }
}
