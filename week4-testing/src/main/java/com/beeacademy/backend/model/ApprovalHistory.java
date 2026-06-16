package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "course_approval_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalHistory {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Profile admin;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "comment")
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static ApprovalHistory create(Course course, Profile admin, String action, String comment) {
        ApprovalHistory h = new ApprovalHistory();
        h.id = UUID.randomUUID();
        h.course = course;
        h.admin = admin;
        h.action = action;
        h.comment = comment;
        return h;
    }
}
