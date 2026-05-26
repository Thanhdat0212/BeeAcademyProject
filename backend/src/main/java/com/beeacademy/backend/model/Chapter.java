package com.beeacademy.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Chương học - tầng giữa của cây Course → Chapter → Lesson.
 *
 * <p>Quan hệ:
 * <ul>
 *   <li>{@code @ManyToOne Course} (LAZY, @JsonIgnore): chương thuộc 1 khoá.</li>
 *   <li>{@code @OneToMany Lesson} (LAZY): danh sách bài học - sắp xếp theo
 *       {@code position} ASC nhờ {@code @OrderBy}.</li>
 * </ul>
 *
 * <p>{@code CascadeType.ALL} + {@code orphanRemoval=true} cho lessons:
 * khi giáo viên xoá chapter, lessons con tự xoá theo. Không hỗ trợ move
 * lesson sang chapter khác qua relation (làm trực tiếp bằng update field
 * {@code chapter_id} nếu cần).
 */
@Entity
@Table(name = "chapters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Chapter {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    @JsonIgnore
    private Course course;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    /** Vị trí (1, 2, 3, …). */
    @Column(name = "position", nullable = false)
    private Integer position;

    /**
     * Danh sách lesson trong chapter. LAZY - chỉ load khi service explicit gọi.
     * Sắp xếp ngay ở SQL bằng {@code @OrderBy} → không cần sort trong Java.
     */
    @OneToMany(mappedBy = "chapter", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Lesson> lessons = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Trả về unmodifiable list để bên ngoài không tự ý mutate. */
    public List<Lesson> getLessons() {
        return Collections.unmodifiableList(lessons);
    }
}
