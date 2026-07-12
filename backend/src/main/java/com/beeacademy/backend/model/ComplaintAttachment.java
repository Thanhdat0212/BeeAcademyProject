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
 * File đính kèm (ảnh/PDF evidence) của một tin nhắn khiếu nại.
 *
 * <p>Lưu trên bucket PRIVATE {@code complaint-attachments} — chỉ giữ
 * {@code storagePath}, backend sinh signed URL khi đọc (giống video bài giảng).
 */
@Entity
@Table(name = "complaint_attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ComplaintAttachment {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private ComplaintMessage message;

    @Column(name = "storage_path", nullable = false, columnDefinition = "TEXT")
    private String storagePath;

    @Column(name = "file_name", nullable = false, columnDefinition = "TEXT")
    private String fileName;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    static ComplaintAttachment create(ComplaintMessage message, String storagePath,
                                      String fileName, String contentType, long sizeBytes) {
        ComplaintAttachment attachment = new ComplaintAttachment();
        attachment.id = UUID.randomUUID();
        attachment.message = message;
        attachment.storagePath = storagePath;
        attachment.fileName = fileName;
        attachment.contentType = contentType;
        attachment.sizeBytes = sizeBytes;
        return attachment;
    }
}
