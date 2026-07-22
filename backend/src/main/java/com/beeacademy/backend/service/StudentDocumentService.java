package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.DocumentDownloadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.StudentDocumentDownload;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentDocumentDownloadRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.PdfStamper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/** UC15: cấp one-time download link theo quyền sở hữu và ghi audit download. */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentDocumentService {

    private static final String DOCUMENT_BUCKET = "course-documents";
    private static final String LEGACY_DOCUMENT_BUCKET = "course-docs";
    private static final int SIGNED_URL_TTL_SECONDS = 5 * 60;
    private static final int MAX_DOWNLOADS_PER_HOUR = 10;
    private static final String DOWNLOAD_ENDPOINT = "/api/document-downloads/";

    private final SupabaseStorageClient storageClient;
    private final CourseDocumentRepository documentRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final StudentDocumentDownloadRepository downloadRepository;

    @Transactional
    public DocumentDownloadResponse createDownload(UUID courseId, UUID lessonId,
                                                   UUID documentId, AuthenticatedUser me) {
        requireEnrollment(me, courseId);

        CourseDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseDocument", documentId));
        if (!document.getLesson().getId().equals(lessonId)
                || !document.getLesson().getChapter().getCourse().getId().equals(courseId)) {
            throw new ResourceNotFoundException("CourseDocument", documentId);
        }

        String storagePath = resolveStoragePath(document);
        if (storagePath == null || storagePath.isBlank()) {
            throw new BusinessException("DOCUMENT_UNAVAILABLE",
                    "Tài liệu hiện chưa sẵn sàng để tải.", HttpStatus.NOT_FOUND);
        }

        Instant now = Instant.now();
        long downloadsLastHour = downloadRepository
                .countByStudentIdAndDocumentIdAndDownloadedAtAfter(
                        me.userId(), documentId, now.minusSeconds(60 * 60));
        if (downloadsLastHour >= MAX_DOWNLOADS_PER_HOUR) {
            throw new BusinessException("DOCUMENT_DOWNLOAD_RATE_LIMIT",
                    "Bạn đã tải tài liệu quá 10 lần trong một giờ. Vui lòng thử lại sau.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        // Every format is served by our atomic, one-time token endpoint. Legacy
        // objects are moved out of the public bucket before a link is issued so
        // the original public URL cannot bypass the five-minute access policy.
        storagePath = ensurePrivateStorage(document);
        if (storagePath == null || storagePath.isBlank()) {
            throw new BusinessException("DOCUMENT_UNAVAILABLE",
                    "Tài liệu hiện chưa sẵn sàng để tải.", HttpStatus.NOT_FOUND);
        }

        boolean watermarked = isPdf(document.getFileType());
        String temporaryPath = null;
        if (watermarked) {
            byte[] original = storageClient.download(DOCUMENT_BUCKET, storagePath);
            byte[] marked = watermarkPdf(original, studentDisplayName(me), me.email());
            temporaryPath = "downloads/" + me.userId() + "/" + documentId + "/"
                    + UUID.randomUUID() + ".pdf";
            storageClient.upload(DOCUMENT_BUCKET, temporaryPath, "application/pdf", marked);
        }

        Instant expiresAt = now.plusSeconds(SIGNED_URL_TTL_SECONDS);
        String token = UUID.randomUUID().toString();
        downloadRepository.save(StudentDocumentDownload.create(
                me.userId(), documentId, now, expiresAt, temporaryPath, hashToken(token)));

        return new DocumentDownloadResponse(
                DOWNLOAD_ENDPOINT + token,
                expiresAt,
                watermarked,
                true
        );
    }

    /** Consume token atomically before streaming bytes; replay cannot reach Supabase. */
    @Transactional
    public DownloadedDocument consumeDownload(String token) {
        String tokenHash = hashToken(token);
        Instant now = Instant.now();
        if (downloadRepository.consumeActiveToken(tokenHash, now) != 1) {
            throw new BusinessException("DOCUMENT_DOWNLOAD_LINK_INVALID",
                    "Liên kết tải đã được dùng hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
                    HttpStatus.GONE);
        }

        StudentDocumentDownload download = downloadRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("DOCUMENT_DOWNLOAD_LINK_INVALID",
                        "Liên kết tải không hợp lệ.", HttpStatus.GONE));
        CourseDocument document = documentRepository.findById(download.getDocumentId())
                .orElseThrow(() -> new BusinessException("DOCUMENT_UNAVAILABLE",
                        "Tài liệu không còn khả dụng.", HttpStatus.NOT_FOUND));
        String bucket = download.getTemporaryStoragePath() != null
                ? DOCUMENT_BUCKET
                : resolveStorageBucket(document);
        String objectPath = download.getTemporaryStoragePath() != null
                ? download.getTemporaryStoragePath()
                : resolveStoragePath(document);
        if (objectPath == null || objectPath.isBlank()) {
            throw new BusinessException("DOCUMENT_UNAVAILABLE",
                    "Tài liệu hiện chưa sẵn sàng để tải.", HttpStatus.NOT_FOUND);
        }
        byte[] bytes = storageClient.download(bucket, objectPath);
        return new DownloadedDocument(bytes, filename(document), contentType(document));
    }

    /** Don dep PDF watermark tam sau khi URL da het han, giu log de doi soat. */
    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void cleanupExpiredWatermarkedFiles() {
        Instant now = Instant.now();
        for (StudentDocumentDownload download : downloadRepository.findExpiredTemporaryDownloads(now)) {
            storageClient.delete(DOCUMENT_BUCKET, download.getTemporaryStoragePath());
            download.clearTemporaryStoragePath();
            downloadRepository.save(download);
        }
    }

    /** Di trú dần tài liệu cũ khỏi public bucket, không cần chờ học viên tải. */
    @Scheduled(initialDelay = 30_000L, fixedDelay = 5 * 60_000L)
    @Transactional
    public void migrateLegacyDocuments() {
        List<CourseDocument> legacyDocuments = documentRepository
                .findTop25ByStorageBucketIsNullOrStorageBucketNotOrderByCreatedAtAsc(DOCUMENT_BUCKET);
        for (CourseDocument document : legacyDocuments) {
            try {
                ensurePrivateStorage(document);
            } catch (Exception ex) {
                log.warn("Chưa thể di trú tài liệu legacy {} sang private bucket: {}",
                        document.getId(), ex.getMessage());
            }
        }
    }

    private void requireEnrollment(AuthenticatedUser me, UUID courseId) {
        if (me == null || me.userId() == null
                || !enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException("COURSE_NOT_ENROLLED",
                    "Bạn cần mua khóa học trước khi tải tài liệu.", HttpStatus.FORBIDDEN);
        }
    }

    private String resolveStoragePath(CourseDocument document) {
        if (document.getStoragePath() != null && !document.getStoragePath().isBlank()) {
            return document.getStoragePath();
        }
        String publicUrl = document.getFileUrl();
        if (publicUrl == null) return null;
        String bucket = document.getStorageBucket();
        if (bucket == null || bucket.isBlank()) bucket = LEGACY_DOCUMENT_BUCKET;
        String marker = "/storage/v1/object/public/" + bucket + "/";
        int markerIndex = publicUrl.indexOf(marker);
        return markerIndex >= 0 ? publicUrl.substring(markerIndex + marker.length()) : null;
    }

    private String resolveStorageBucket(CourseDocument document) {
        String bucket = document.getStorageBucket();
        return bucket == null || bucket.isBlank() ? LEGACY_DOCUMENT_BUCKET : bucket;
    }

    private String ensurePrivateStorage(CourseDocument document) {
        String currentBucket = document.getStorageBucket();
        String storagePath = resolveStoragePath(document);
        if (DOCUMENT_BUCKET.equals(currentBucket) && storagePath != null && !storagePath.isBlank()) {
            return storagePath;
        }
        if (storagePath == null || storagePath.isBlank()) return null;

        String sourceBucket = currentBucket == null || currentBucket.isBlank()
                ? LEGACY_DOCUMENT_BUCKET : currentBucket;
        byte[] source = storageClient.download(sourceBucket, storagePath);
        String privatePath = "documents/" + document.getId() + "/" + UUID.randomUUID()
                + extension(document.getFileType());
        storageClient.upload(DOCUMENT_BUCKET, privatePath, contentType(document), source);
        document.moveToPrivateStorage(DOCUMENT_BUCKET, privatePath);
        documentRepository.save(document);
        scheduleLegacyDeletion(sourceBucket, storagePath);
        log.info("Đã di trú tài liệu {} tu {}/{} sang private bucket",
                document.getId(), sourceBucket, storagePath);
        return privatePath;
    }

    private boolean isPdf(String fileType) {
        return fileType != null && (fileType.equalsIgnoreCase("pdf")
                || fileType.toLowerCase().contains("pdf"));
    }

    private String contentType(CourseDocument document) {
        String type = document.getFileType() == null ? "" : document.getFileType().toLowerCase();
        return switch (type) {
            case "pdf" -> "application/pdf";
            case "ppt" -> "application/vnd.ms-powerpoint";
            case "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> "application/octet-stream";
        };
    }

    private String filename(CourseDocument document) {
        String name = document.getName() == null ? "tai-lieu" : document.getName().trim();
        String extension = extension(document.getFileType());
        return name.toLowerCase().endsWith(extension) ? name : name + extension;
    }

    private String extension(String fileType) {
        if (fileType == null || fileType.isBlank()) return "";
        String normalized = fileType.replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return normalized.isBlank() ? "" : "." + normalized;
    }

    private String hashToken(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException("DOCUMENT_DOWNLOAD_LINK_INVALID",
                    "Liên kết tải không hợp lệ.", HttpStatus.GONE);
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 không khả dụng", ex);
        }
    }

    private void scheduleLegacyDeletion(String bucket, String path) {
        if (DOCUMENT_BUCKET.equals(bucket)) return;
        if (!org.springframework.transaction.support.TransactionSynchronizationManager
                .isSynchronizationActive()) {
            storageClient.delete(bucket, path);
            return;
        }
        org.springframework.transaction.support.TransactionSynchronizationManager
                .registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        storageClient.delete(bucket, path);
                    }
                });
    }

    private String studentDisplayName(AuthenticatedUser me) {
        return profileRepository.findById(me.userId())
                .map(Profile::getFullName)
                .filter(name -> name != null && !name.isBlank())
                .map(String::trim)
                .orElse("Học sinh");
    }

    private byte[] watermarkPdf(byte[] original, String studentName, String email) {
        try {
            PdfReader reader = new PdfReader(original);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            PdfStamper stamper = new PdfStamper(reader, output);
            Font font = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(120, 120, 120));
            String watermark = "Bee Academy - " + studentName
                    + (email == null || email.isBlank() ? "" : " <" + email + ">");
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                Rectangle pageSize = reader.getPageSizeWithRotation(page);
                ColumnText.showTextAligned(
                        stamper.getOverContent(page), Element.ALIGN_CENTER,
                        new Phrase(watermark, font), pageSize.getWidth() / 2f, 20f, 0f);
            }
            stamper.close();
            reader.close();
            return output.toByteArray();
        } catch (Exception ex) {
            log.error("Không thể đóng dấu tài liệu PDF", ex);
            throw new BusinessException("DOCUMENT_WATERMARK_FAILED",
                    "Không thể tạo bản tài liệu cá nhân hóa.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public record DownloadedDocument(byte[] bytes, String filename, String contentType) {
    }
}
