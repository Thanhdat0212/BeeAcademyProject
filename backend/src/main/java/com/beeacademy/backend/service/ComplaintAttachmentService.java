package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.ComplaintMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Upload + cấp signed URL cho file đính kèm khiếu nại (ảnh/PDF evidence).
 *
 * <p>Bucket PRIVATE {@code complaint-attachments}: chỉ lưu storage path, sinh
 * signed URL TTL 1 giờ khi đọc — bảo vệ evidence nhạy cảm (ảnh chụp giao dịch...).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComplaintAttachmentService {

    private static final String BUCKET = "complaint-attachments";
    private static final int SIGNED_URL_TTL = 3600;

    private static final Set<String> ALLOWED_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf");
    private static final long MAX_FILE_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final int MAX_FILES = 5;

    private final SupabaseStorageClient storageClient;

    /**
     * Validate + upload các file rồi gắn vào {@code message} (cascade khi save).
     * Đăng ký cleanup storage nếu transaction rollback để tránh file mồ côi.
     */
    public void attachTo(ComplaintMessage message, UUID complaintId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) return;

        List<MultipartFile> realFiles = files.stream()
                .filter(f -> f != null && !f.isEmpty())
                .toList();
        if (realFiles.isEmpty()) return;

        if (realFiles.size() > MAX_FILES) {
            throw new BusinessException("TOO_MANY_FILES",
                    "Tối đa " + MAX_FILES + " file đính kèm cho mỗi tin nhắn.");
        }

        for (MultipartFile file : realFiles) {
            validate(file);
            String ext  = extensionFor(file.getContentType());
            String path = complaintId + "/" + message.getId() + "/" + UUID.randomUUID() + "." + ext;

            storageClient.upload(BUCKET, path, file.getContentType(),
                                 file.getResource(), file.getSize());
            deleteOnRollback(path);

            message.addAttachment(path,
                    safeName(file.getOriginalFilename(), ext),
                    file.getContentType(),
                    file.getSize());
        }
    }

    /** Signed URL tạm thời để xem/tải file đính kèm. */
    public String signedUrl(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return null;
        return storageClient.generateSignedUrl(BUCKET, storagePath, SIGNED_URL_TTL);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void validate(MultipartFile file) {
        String mime = file.getContentType();
        if (mime == null || !ALLOWED_MIME.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận ảnh JPEG, PNG, WEBP hoặc PDF.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "Mỗi file không được vượt quá 5MB.");
        }
    }

    private void deleteOnRollback(String path) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    try {
                        storageClient.delete(BUCKET, path);
                    } catch (RuntimeException ex) {
                        log.warn("Không cleanup được file đính kèm {}/{}: {}", BUCKET, path, ex.getMessage());
                    }
                }
            }
        });
    }

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png"  -> "png";
            case "image/webp" -> "webp";
            case "application/pdf" -> "pdf";
            default -> throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận ảnh JPEG, PNG, WEBP hoặc PDF.", HttpStatus.BAD_REQUEST);
        };
    }

    private String safeName(String original, String ext) {
        if (original == null || original.isBlank()) return "file." + ext;
        return original.length() > 200 ? original.substring(0, 200) : original;
    }
}
