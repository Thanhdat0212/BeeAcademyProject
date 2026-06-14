package com.beeacademy.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
 * Bài học (video / PDF). Cấp dưới cùng trong cây nội dung: Course → Chapter → Lesson.
 *
 * <p>Schema Supabase:
 * <ul>
 *   <li>{@code chapter_id} FK đến {@code chapters.id}.</li>
 *   <li>{@code is_free}: cho phép guest xem thử nội dung này (UC08).</li>
 *   <li>{@code resources jsonb}: array file đính kèm. Ở GĐ này KHÔNG map ra
 *       entity (chưa cần) - sẽ thêm sau với {@code @JdbcTypeCode JSON}.</li>
 * </ul>
 *
 * <p>{@code @JsonIgnore} trên {@code chapter} để Jackson KHÔNG cố
 * serialize ngược lên parent (phòng trường hợp ai đó vô tình trả entity
 * thẳng ra response). Convention chính của project là LUÔN map qua DTO,
 * annotation này chỉ là lưới an toàn.
 */
@Entity
@Table(name = "lessons")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Lesson {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /**
     * Quan hệ ngược về Chapter - LAZY để không tự load khi đọc lesson.
     * Service chủ động fetch khi cần (vd: join fetch trong query).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chapter_id", nullable = false)
    @JsonIgnore
    private Chapter chapter;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    /**
     * URL embed (YouTube/Vimeo). Nullable — chỉ có khi videoSource = 'embed'.
     * Không cần signed URL vì là link công khai.
     */
    @Column(name = "video_embed_url")
    private String videoEmbedUrl;

    /**
     * Path trong Supabase Storage private bucket "course-videos".
     * Dạng: "{courseId}/{chapterId}/{lessonId}.mp4"
     * Khi không null → backend generate signed URL khi student xem.
     * Khi null → dùng videoUrl hoặc videoEmbedUrl.
     */
    @Column(name = "video_storage_path")
    private String videoStoragePath;

    /** URL công khai (Supabase public bucket hoặc URL cũ). Nullable. */
    @Column(name = "video_url")
    private String videoUrl;

    /** Thời lượng tính bằng giây. Mặc định 0 trước khi upload xong. */
    @Column(name = "duration_sec", nullable = false)
    private Integer durationSec;

    /** Thứ tự trong chapter (1, 2, 3, …). */
    @Column(name = "position", nullable = false)
    private Integer position;

    /** Cho guest xem thử mà không cần mua khoá. */
    @Column(name = "is_free", nullable = false)
    private Boolean isFree;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // ========================================================================
    // Factory + business methods
    // ========================================================================

    /**
     * Tạo lesson mới cho một chapter.
     *
     * @param chapter  chapter cha
     * @param title    tiêu đề bài học
     * @param position thứ tự trong chapter (bắt đầu từ 1)
     * @param isFree   cho phép guest xem thử không
     */
    public static Lesson createNew(Chapter chapter, String title,
                                   String description, Integer position, boolean isFree) {
        Lesson l = new Lesson();
        l.id          = UUID.randomUUID();
        l.chapter     = chapter;
        l.title       = title;
        l.description = description;
        l.position    = position;
        l.isFree      = isFree;
        l.durationSec = 0;
        return l;
    }

    /** Cập nhật thông tin bài học (không thay đổi video). */
    public void update(String title, String description, Integer position,
                       boolean isFree, String videoEmbedUrl) {
        if (title != null && !title.isBlank()) this.title = title.trim();
        if (description != null) this.description = description;
        if (position != null && position > 0) this.position = position;
        this.isFree       = isFree;
        this.videoEmbedUrl = videoEmbedUrl;
    }

    /**
     * Ghi nhận video đã upload lên Supabase Storage private bucket.
     * Path được dùng sau này để generate signed URL.
     */
    public void setVideoStoragePath(String path, int durationSec) {
        this.videoStoragePath = path;
        this.videoUrl         = null;   // xoá URL cũ nếu có, ưu tiên storage path
        this.durationSec      = durationSec;
    }
}
