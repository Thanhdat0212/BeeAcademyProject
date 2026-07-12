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
 * Tài liệu đính kèm (PDF, slide) cho một bài giảng.
 *
 * <p>File được upload lên Supabase Storage bucket private "course-documents".
 * Học viên chỉ nhận one-time download link do backend cấp (UC15).
 *
 * <p>Quan hệ: N bài giảng có M tài liệu đính kèm (1 lesson → nhiều document).
 */
@Entity
@Table(name = "course_documents")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseDocument {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;

    /** Tên hiển thị (vd: "Tài liệu chương 1"). */
    @Column(name = "name", nullable = false)
    private String name;

    /** URL legacy từ bucket public; không được trả về cho học viên. */
    @Column(name = "file_url")
    private String fileUrl;

    /** Path trong bucket storage, dùng để tạo signed URL khi học sinh tải. */
    @Column(name = "storage_path")
    private String storagePath;

    /** Bucket chứa object. Bản ghi cũ mặc định là course-docs để được di trú an toàn. */
    @Column(name = "storage_bucket")
    private String storageBucket;

    /** Loại file: pdf | pptx | docx. */
    @Column(name = "file_type", nullable = false)
    private String fileType;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    /** Thứ tự hiển thị trong lesson (1, 2, 3…). */
    @Column(name = "position", nullable = false)
    private Integer position;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Factory — tạo document mới sau khi upload thành công. */
    public static CourseDocument create(Lesson lesson, String name,
                                        String fileUrl, String fileType,
                                        long fileSizeBytes, int position) {
        return create(lesson, name, fileUrl, null, fileType, fileSizeBytes, position);
    }

    public static CourseDocument create(Lesson lesson, String name,
                                        String fileUrl, String storagePath,
                                        String fileType, long fileSizeBytes, int position) {
        return create(lesson, name, fileUrl, storagePath, "course-docs",
                fileType, fileSizeBytes, position);
    }

    public static CourseDocument create(Lesson lesson, String name,
                                        String fileUrl, String storagePath,
                                        String storageBucket, String fileType,
                                        long fileSizeBytes, int position) {
        CourseDocument d = new CourseDocument();
        d.id            = UUID.randomUUID();
        d.lesson        = lesson;
        d.name          = name;
        d.fileUrl       = fileUrl;
        d.storagePath   = storagePath;
        d.storageBucket = storageBucket;
        d.fileType      = fileType;
        d.fileSizeBytes = fileSizeBytes;
        d.position      = position;
        return d;
    }

    /** Chuyển metadata sang object private sau khi di trú xong. */
    public void moveToPrivateStorage(String bucket, String path) {
        this.storageBucket = bucket;
        this.storagePath = path;
        this.fileUrl = null;
    }
}
