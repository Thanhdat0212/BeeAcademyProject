package com.beeacademy.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Khoá học - aggregate root cho module Courses.
 *
 * <p>Quan hệ (tất cả LAZY để không load thừa khi list):
 * <ul>
 *   <li>{@code @ManyToOne Category} - 1 khoá học thuộc 1 danh mục.</li>
 *   <li>{@code @ManyToOne Profile (teacher)} - 1 khoá học có 1 giáo viên.
 *       FK đến {@code profiles.id} (đã verify).</li>
 *   <li>{@code @OneToMany Chapter} - sắp xếp theo {@code position} ASC.</li>
 * </ul>
 *
 * <p>Field đặc biệt:
 * <ul>
 *   <li>{@code grades int[]}: array Postgres - map qua {@code @JdbcTypeCode
 *       SqlTypes.ARRAY}. Vd: {@code {8, 9}} cho khoá học liên lớp.</li>
 *   <li>{@code status course_status} enum - map qua {@code @JdbcTypeCode
 *       NAMED_ENUM} với {@code columnDefinition} đúng tên enum Postgres.</li>
 *   <li>{@code priceVnd / salePriceVnd}: INTEGER VND nguyên (không
 *       BigDecimal) - theo {@link com.beeacademy.backend.model.UserRole}.</li>
 *   <li>{@code totalChapters/totalLessons/totalDurationSec}: denormalized
 *       counter - trigger Postgres tự update khi chapter/lesson thay đổi
 *       (giả định có trigger; nếu không service phải tự cập nhật).</li>
 * </ul>
 */
@Entity
@Table(name = "courses")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Course {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** URL-friendly identifier (UNIQUE). Frontend có thể dùng thay cho UUID. */
    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    /** Public URL của thumbnail (Cloudinary / Supabase Storage). */
    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    /**
     * Profile của giáo viên (cùng bảng với học sinh, phân biệt qua role).
     * NOT NULL ở DB - mọi khoá học phải có teacher_id.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Profile teacher;

    /**
     * Lớp mục tiêu (vd: {6}, {7,8}, {9}). Map int[] Postgres → int[] Java.
     */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "grades", nullable = false, columnDefinition = "integer[]")
    private int[] grades;

    @Column(name = "price_vnd", nullable = false)
    private Integer priceVnd;

    /** Giá khuyến mãi, null nếu không giảm giá. */
    @Column(name = "sale_price_vnd")
    private Integer salePriceVnd;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "course_status")
    private CourseStatus status;

    @Column(name = "is_featured", nullable = false)
    private Boolean isFeatured;

    @Column(name = "total_chapters", nullable = false)
    private Integer totalChapters;

    @Column(name = "total_lessons", nullable = false)
    private Integer totalLessons;

    @Column(name = "total_duration_sec", nullable = false)
    private Integer totalDurationSec;

    /** Thời điểm publish - null nếu chưa published. */
    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Danh sách chapter. LAZY - service quyết định khi nào fetch.
     * @OrderBy đảm bảo SQL sắp xếp sẵn, không phải sort trong Java.
     */
    @OneToMany(mappedBy = "course", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Chapter> chapters = new ArrayList<>();

    // ========================================================================
    // Read-only getters cho field collection (immutable view)
    // ========================================================================

    public List<Chapter> getChapters() {
        return Collections.unmodifiableList(chapters);
    }

    /** Trả copy của grades để bên ngoài không thể mutate array gốc. */
    public int[] getGrades() {
        return grades == null ? new int[0] : Arrays.copyOf(grades, grades.length);
    }

    /**
     * Giá thực tế khách hàng phải trả: ưu tiên {@code salePriceVnd},
     * fallback {@code priceVnd}. Đặt ở entity vì là invariant nghiệp vụ
     * (logic "giá thực" thuộc về khoá học).
     */
    public int getEffectivePriceVnd() {
        return salePriceVnd != null ? salePriceVnd : priceVnd;
    }

    /**
     * Có đang giảm giá không? Dùng trong DTO để hiển thị badge SALE.
     */
    public boolean isOnSale() {
        return salePriceVnd != null && salePriceVnd < priceVnd;
    }
}
