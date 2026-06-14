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

/**
 * Lịch sử từng lần Admin duyệt / từ chối / yêu cầu sửa khóa học.
 *
 * <p>Mỗi hành động của Admin tạo 1 row — GV xem được timeline đầy đủ
 * để biết lý do và sửa đúng chỗ.
 *
 * <p>Trường {@code action} nhận 3 giá trị:
 * <ul>
 *   <li>{@code approved}       — Admin duyệt, khóa được xuất bản.</li>
 *   <li>{@code rejected}       — Admin từ chối vĩnh viễn.</li>
 *   <li>{@code needs_revision} — Admin yêu cầu GV sửa rồi nộp lại.</li>
 * </ul>
 */
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

    /** Admin thực hiện hành động. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Profile admin;

    /** "approved" | "rejected" | "needs_revision" */
    @Column(name = "action", nullable = false)
    private String action;

    /** Nhận xét / lý do — bắt buộc khi reject hoặc needs_revision. */
    @Column(name = "comment")
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Factory — tạo history record mới. */
    public static ApprovalHistory create(Course course, Profile admin,
                                          String action, String comment) {
        ApprovalHistory h = new ApprovalHistory();
        h.id      = UUID.randomUUID();
        h.course  = course;
        h.admin   = admin;
        h.action  = action;
        h.comment = comment;
        return h;
    }
}
