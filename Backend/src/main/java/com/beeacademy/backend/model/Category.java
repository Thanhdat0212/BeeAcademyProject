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
 * Danh mục môn học (Toán học, Ngữ văn, Tiếng Anh, …).
 *
 * <p>Bảng đã có sẵn 8 row seed trên Supabase (toan-hoc, ngu-van, …),
 * Hibernate KHÔNG được sửa schema ({@code ddl-auto=none}).
 *
 * <p>{@code slug} là khoá tự nhiên dùng để filter từ URL (vd:
 * {@code /api/courses?subject=toan-hoc}). Tốt hơn UUID vì SEO-friendly,
 * dễ chia sẻ link.
 *
 * <p>Tại sao KHÔNG có {@code @OneToMany List<Course>} ở Category:
 * <ul>
 *   <li>Quan hệ ngược ít dùng - thường ta query courses theo category_id,
 *       không phải category đi xuống tất cả courses.</li>
 *   <li>Bidirectional thêm phức tạp cho JSON serialization mà lợi ích thấp.</li>
 *   <li>Nếu sau này cần "đếm số khoá học theo category", dùng query
 *       riêng trong repository, không lazy load.</li>
 * </ul>
 */
@Entity
@Table(name = "categories")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Category {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** Slug URL-friendly, vd: "toan-hoc". UNIQUE trên DB. */
    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    /** Tên hiển thị tiếng Việt, vd: "Toán học". */
    @Column(name = "name", nullable = false)
    private String name;

    /** Emoji hoặc URL icon (nullable). */
    @Column(name = "icon")
    private String icon;

    /** Thứ tự hiển thị trong filter dropdown. */
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
