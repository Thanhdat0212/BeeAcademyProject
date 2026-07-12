package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "course_progress_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseProgressItem {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID itemId;

    @Column(name = "item_type", nullable = false, updatable = false)
    private String itemType;

    @CreationTimestamp
    @Column(name = "completed_at", nullable = false, updatable = false)
    private Instant completedAt;

    public static CourseProgressItem create(UUID studentId, UUID courseId, UUID itemId, String itemType) {
        CourseProgressItem item = new CourseProgressItem();
        item.id = UUID.randomUUID();
        item.studentId = studentId;
        item.courseId = courseId;
        item.itemId = itemId;
        item.itemType = itemType;
        return item;
    }
}
