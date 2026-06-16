package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * H2-adapted version:
 * - grades: luu duoi dang String "6,7,8" thay vi int[] PostgreSQL ARRAY
 * - status: dung @Enumerated(EnumType.STRING) thay vi @Convert + @ColumnTransformer
 * - Bo tat ca @ColumnTransformer (cast syntax PostgreSQL)
 */
@Entity
@Table(name = "courses")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Course {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Profile teacher;

    // H2-adapted: luu grades nhu "6,7,8" (comma-separated string)
    @Column(name = "grades", nullable = false)
    private String grades;

    @Column(name = "price_vnd", nullable = false)
    private Integer priceVnd;

    @Column(name = "sale_price_vnd")
    private Integer salePriceVnd;

    // H2-adapted: @Enumerated(STRING) thay vi @Convert + @ColumnTransformer
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CourseStatus status;

    @Column(name = "is_featured", nullable = false)
    private Boolean isFeatured;

    @Column(name = "total_chapters", nullable = false)
    private Integer totalChapters;

    @Column(name = "total_lessons", nullable = false)
    private Integer totalLessons;

    @Column(name = "total_duration_sec", nullable = false)
    private Integer totalDurationSec;

    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "course", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Chapter> chapters = new ArrayList<>();

    public List<Chapter> getChapters() {
        return Collections.unmodifiableList(chapters);
    }

    /** Parse "6,7,8" -> int[]{6,7,8} */
    public int[] getGrades() {
        if (grades == null || grades.isBlank()) return new int[0];
        return Arrays.stream(grades.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .mapToInt(Integer::parseInt).toArray();
    }

    public int getEffectivePriceVnd() {
        return salePriceVnd != null ? salePriceVnd : priceVnd;
    }

    public boolean isOnSale() {
        return salePriceVnd != null && salePriceVnd < priceVnd;
    }

    public static Course createByTeacher(Profile teacher, String title, String description,
                                         Category category, int[] gradesArr, int priceVnd) {
        Course c = new Course();
        c.id = UUID.randomUUID();
        c.teacher = teacher;
        c.title = title.trim();
        c.description = description;
        c.category = category;
        c.grades = Arrays.stream(gradesArr).mapToObj(String::valueOf)
                .collect(Collectors.joining(","));
        c.priceVnd = priceVnd;
        c.status = CourseStatus.DRAFT;
        c.isFeatured = false;
        c.totalChapters = 0;
        c.totalLessons = 0;
        c.totalDurationSec = 0;
        c.slug = title.trim().toLowerCase()
                     .replaceAll("[^a-z0-9\\s-]", "")
                     .replaceAll("\\s+", "-");
        return c;
    }

    public void update(String title, String description, Category category,
                       int[] gradesArr, int priceVnd, Integer salePriceVnd, String thumbnailUrl) {
        if (title != null && !title.isBlank()) this.title = title.trim();
        if (description != null) this.description = description;
        if (category != null) this.category = category;
        if (gradesArr != null) {
            this.grades = Arrays.stream(gradesArr).mapToObj(String::valueOf)
                    .collect(Collectors.joining(","));
        }
        if (priceVnd > 0) this.priceVnd = priceVnd;
        this.salePriceVnd = salePriceVnd;
        if (thumbnailUrl != null) this.thumbnailUrl = thumbnailUrl;
    }

    public void setThumbnailUrl(String url) { this.thumbnailUrl = url; }

    public void recalculateCounts() {
        this.totalChapters = chapters.size();
        this.totalLessons = chapters.stream().mapToInt(ch -> ch.getLessons().size()).sum();
        this.totalDurationSec = chapters.stream()
                .flatMap(ch -> ch.getLessons().stream())
                .mapToInt(l -> l.getDurationSec() != null ? l.getDurationSec() : 0).sum();
    }

    public void submitForReview() {
        if (status != CourseStatus.DRAFT
                && status != CourseStatus.NEEDS_REVISION
                && status != CourseStatus.REJECTED) {
            throw new IllegalStateException(
                "Chỉ có thể nộp duyệt khi khóa học ở trạng thái Bản nháp, Cần sửa hoặc Bị từ chối.");
        }
        this.status = CourseStatus.PENDING_REVIEW;
    }

    public void approve() {
        if (status != CourseStatus.PENDING_REVIEW)
            throw new IllegalStateException("Chỉ duyệt được khi khóa học đang chờ duyệt.");
        this.status = CourseStatus.PUBLISHED;
        this.publishedAt = Instant.now();
    }

    public void reject() {
        if (status != CourseStatus.PENDING_REVIEW)
            throw new IllegalStateException("Chỉ từ chối được khi khóa học đang chờ duyệt.");
        this.status = CourseStatus.REJECTED;
    }

    public void needsRevision() {
        if (status != CourseStatus.PENDING_REVIEW)
            throw new IllegalStateException("Chỉ yêu cầu sửa khi khóa học đang chờ duyệt.");
        this.status = CourseStatus.NEEDS_REVISION;
    }
}
