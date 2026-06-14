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
 * <p>File được upload lên Supabase Storage bucket "course-docs" (PUBLIC).
 * URL truy cập trực tiếp không cần signed URL.
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

    /** Supabase Storage public URL. */
    @Column(name = "file_url", nullable = false)
    private String fileUrl;

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
        CourseDocument d = new CourseDocument();
        d.id            = UUID.randomUUID();
        d.lesson        = lesson;
        d.name          = name;
        d.fileUrl       = fileUrl;
        d.fileType      = fileType;
        d.fileSizeBytes = fileSizeBytes;
        d.position      = position;
        return d;
    }
}
