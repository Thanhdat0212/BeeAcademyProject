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

/**
 * Ghi nhận học sinh đã mua (enroll) một khoá học.
 *
 * <p>Mỗi row = 1 giao dịch mua thành công. UNIQUE(user_id, course_id) đảm
 * bảo 1 học sinh không thể mua cùng khoá 2 lần.
 *
 * <p>Quan hệ:
 * <ul>
 *   <li>{@code userId} → {@code profiles.id} của học sinh.</li>
 *   <li>{@code courseId} → {@code courses.id} của khoá học.</li>
 * </ul>
 *
 * <p>Tại sao dùng UUID fields thay vì @ManyToOne?<br>
 * Endpoint kiểm tra enrollment ({@code existsByUserIdAndCourseId}) chỉ cần
 * biết hai UUID có tồn tại cùng nhau không — không cần load toàn bộ
 * entity Profile hay Course. Tránh N+1 và giữ query đơn giản.
 *
 * <p><b>SQL cần chạy trên Supabase trước khi deploy:</b>
 * <pre>
 *   CREATE TABLE IF NOT EXISTS enrollments (
 *       id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *       user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *       course_id       UUID        NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
 *       purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *       price_paid_vnd  INTEGER     NOT NULL DEFAULT 0,
 *       UNIQUE(user_id, course_id)
 *   );
 *   CREATE INDEX idx_enrollments_user_id   ON enrollments(user_id);
 *   CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
 * </pre>
 */
@Entity
@Table(name = "enrollments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Enrollment {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** UUID của học sinh — trỏ đến profiles.id. Cột DB: student_id */
    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    /** UUID của khoá học — trỏ đến courses.id. */
    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @CreationTimestamp
    @Column(name = "enrolled_at", nullable = false, updatable = false)
    private Instant enrolledAt;

    @Column(name = "progress_pct")
    private Integer progressPct;

    public static Enrollment create(UUID studentId, UUID courseId) {
        Enrollment e = new Enrollment();
        e.id = UUID.randomUUID();
        e.studentId = studentId;
        e.courseId = courseId;
        e.progressPct = 0;
        return e;
    }
}
