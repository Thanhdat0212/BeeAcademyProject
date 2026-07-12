package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/** Audit log cho mỗi lượt học sinh yêu cầu tải một tài liệu. */
@Entity
@Table(name = "student_document_downloads")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudentDocumentDownload {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;

    @Column(name = "downloaded_at", nullable = false, updatable = false)
    private Instant downloadedAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "temporary_storage_path")
    private String temporaryStoragePath;

    /** SHA-256 của mã one-time gửi cho browser, không lưu mã gốc vào DB. */
    @Column(name = "token_hash")
    private String tokenHash;

    /** Được set bằng UPDATE có điều kiện để cưỡng chế link chỉ dùng đúng một lần. */
    @Column(name = "consumed_at")
    private Instant consumedAt;

    public static StudentDocumentDownload create(UUID studentId, UUID documentId,
                                                 Instant downloadedAt, Instant expiresAt,
                                                 String temporaryStoragePath, String tokenHash) {
        StudentDocumentDownload log = new StudentDocumentDownload();
        log.id = UUID.randomUUID();
        log.studentId = studentId;
        log.documentId = documentId;
        log.downloadedAt = downloadedAt;
        log.expiresAt = expiresAt;
        log.temporaryStoragePath = temporaryStoragePath;
        log.tokenHash = tokenHash;
        return log;
    }

    /** Xoa duong dan tam sau khi signed URL het han, nhung giu nguyen audit log. */
    public void clearTemporaryStoragePath() {
        this.temporaryStoragePath = null;
    }
}
