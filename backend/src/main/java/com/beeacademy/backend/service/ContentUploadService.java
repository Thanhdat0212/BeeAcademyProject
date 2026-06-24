package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.LessonRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Xử lý upload nội dung khóa học lên Supabase Storage (Phase 2).
 *
 * <p>Hai loại bucket:
 * <ul>
 *   <li>{@code course-videos} — PRIVATE. Video phải được truy cập qua
 *       signed URL (TTL 1 giờ). Lưu {@code storagePath}, không lưu URL.</li>
 *   <li>{@code course-docs}   — PUBLIC. PDF/slide truy cập trực tiếp
 *       qua public URL, không cần signed URL.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentUploadService {

    private static final String VIDEO_BUCKET = "course-videos";
    private static final String DOCS_BUCKET  = "course-docs";
    private static final String THUMBNAIL_BUCKET = DOCS_BUCKET;

    private static final Set<String> ALLOWED_VIDEO_MIME = Set.of(
            "video/mp4", "video/webm", "video/quicktime");
    private static final Set<String> ALLOWED_DOC_MIME = Set.of(
            "application/pdf",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    private static final Set<String> ALLOWED_THUMBNAIL_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp");

    private static final long MAX_VIDEO_BYTES = 2L * 1024 * 1024 * 1024; // 2 GB
    private static final long MAX_DOC_BYTES   = 100L * 1024 * 1024;      // 100 MB
    private static final long MAX_THUMBNAIL_BYTES = 5L * 1024 * 1024; // 5 MB

    private final SupabaseStorageClient  storageClient;
    private final CourseRepository       courseRepository;
    private final LessonRepository       lessonRepository;
    private final CourseDocumentRepository documentRepository;

    // ========================================================================
    // Video upload (Phase 2)
    // ========================================================================

    /**
     * Upload video bài giảng lên private bucket.
     *
     * <p>Path = {@code {courseId}/{chapterId}/{lessonId}/{uuid}.ext}
     * — tạo object mới cho mỗi lần upload, rồi cleanup file cũ sau khi DB commit.
     *
     * @return UploadResponse với storagePath (không có publicUrl — private bucket)
     */
    @Transactional
    public UploadResponse uploadVideo(UUID courseId, UUID chapterId, UUID lessonId,
                                       UUID teacherId, MultipartFile file) {
        validateFile(file, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES,
                     "video MP4, WebM hoặc QuickTime", "2GB");

        // Load course để verify ownership
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        verifyOwner(course, teacherId);

        // BUG FIX: dùng LessonRepository thay vì stream filter toàn bộ collection
        // — tránh load hàng trăm bài giảng vào memory chỉ để tìm 1 lesson
        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        String oldPath = lesson.getVideoStoragePath();
        String ext  = getExtension(file.getOriginalFilename(), "mp4");
        String path = courseId + "/" + chapterId + "/" + lessonId + "/"
                + UUID.randomUUID() + "." + ext;

        storageClient.upload(VIDEO_BUCKET, path,
                             file.getContentType(), file.getResource(), file.getSize());
        deleteUploadedObjectOnRollback(VIDEO_BUCKET, path);

        // Ghi nhận path vào lesson (durationSec=0, GV cập nhật sau nếu cần)
        lesson.setVideoStoragePath(path, 0);
        // BUG FIX: save lesson trực tiếp thay vì save cả Course aggregate
        // — tránh dirty-check toàn bộ chapters/lessons không liên quan
        lessonRepository.save(lesson);
        deleteVideoAfterCommit(oldPath);

        log.info("Upload video thành công: bucket={} path={} size={}",
                 VIDEO_BUCKET, path, file.getSize());
        return new UploadResponse(path, null, file.getContentType(), file.getSize());
    }

    // ========================================================================
    // Document upload (Phase 2)
    // ========================================================================

    /**
     * Upload tài liệu (PDF/slide) lên public bucket và lưu metadata vào DB.
     *
     * <p>BUG FIX so với phiên bản cũ:
     * <ol>
     *   <li>Thêm ownership check: verify GV là chủ lesson trước khi upload.</li>
     *   <li>Lưu CourseDocument entity vào DB sau khi upload thành công
     *       — trước đây chỉ trả URL, không persist → reload trang là mất dữ liệu.</li>
     * </ol>
     *
     * @return UploadResponse với publicUrl truy cập trực tiếp
     */
    @Transactional
    public UploadResponse uploadDocument(UUID lessonId, UUID teacherId,
                                          String displayName, MultipartFile file) {
        validateFile(file, ALLOWED_DOC_MIME, MAX_DOC_BYTES,
                     "PDF, PPTX hoặc DOCX", "100MB");

        // SECURITY FIX: verify GV là chủ lesson trước khi cho phép upload.
        // Trước đây không có check này → bất kỳ GV nào cũng upload được vào lesson của người khác.
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        // Lazy load: lesson.getChapter().getCourse() — OK vì đang trong @Transactional
        UUID lessonOwnerId = lesson.getChapter().getCourse().getTeacher().getId();
        if (!lessonOwnerId.equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền upload tài liệu cho bài giảng này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }

        String ext      = getExtension(file.getOriginalFilename(), "pdf");
        // Path dùng randomUUID để tránh ghi đè khi upload nhiều file cùng lesson
        String path     = lessonId + "/" + UUID.randomUUID() + "." + ext;
        String fileType = ext;

        String publicUrl = storageClient.upload(DOCS_BUCKET, path,
                                                file.getContentType(), file.getResource(), file.getSize());
        deleteUploadedObjectOnRollback(DOCS_BUCKET, path);

        // DATA FIX: lưu CourseDocument vào DB để lesson detail có thể load lại được.
        // Position = số tài liệu hiện tại + 1 (thêm vào cuối)
        int position  = documentRepository.countByLessonId(lessonId) + 1;
        String name   = (displayName != null && !displayName.isBlank())
                        ? displayName.trim()
                        : file.getOriginalFilename();
        CourseDocument doc = CourseDocument.create(lesson, name, publicUrl,
                                                   fileType, file.getSize(), position);
        documentRepository.save(doc);

        log.info("Upload tài liệu thành công: lessonId={} path={} url={}", lessonId, path, publicUrl);
        return new UploadResponse(path, publicUrl, fileType, file.getSize());
    }

    // ========================================================================
    // Signed URL cho video (gọi từ CourseService khi student xem)
    // ========================================================================

    /**
     * Tạo signed URL tạm thời (1 giờ) để student stream video private.
     * Gọi từ {@code CourseService.getCourseDetail()} khi {@code canSeeAllVideos=true}.
     */
    @Transactional
    public UploadResponse uploadCourseThumbnail(UUID teacherId, MultipartFile file) {
        validateFile(file, ALLOWED_THUMBNAIL_MIME, MAX_THUMBNAIL_BYTES,
                     "anh JPEG, PNG hoac WEBP", "5MB");

        String ext = imageExtension(file.getContentType());
        String path = "thumbnails/" + teacherId + "/" + UUID.randomUUID() + "." + ext;

        String publicUrl = storageClient.upload(THUMBNAIL_BUCKET, path,
                                                file.getContentType(), file.getResource(), file.getSize());

        log.info("Upload course thumbnail thanh cong: teacherId={} path={} url={}",
                 teacherId, path, publicUrl);
        return new UploadResponse(path, publicUrl, ext, file.getSize());
    }

    public String generateSignedVideoUrl(String storagePath) {
        return storageClient.generateSignedUrl(VIDEO_BUCKET, storagePath, 3600);
    }

    public void deleteVideoAfterCommit(String storagePath) {
        scheduleDeleteAfterCommit(VIDEO_BUCKET, storagePath);
    }

    public void deleteLessonFilesAfterCommit(Collection<Lesson> lessons,
                                             Collection<CourseDocument> documents) {
        LinkedHashSet<String> videoPaths = new LinkedHashSet<>();
        if (lessons != null) {
            lessons.stream()
                    .map(Lesson::getVideoStoragePath)
                    .filter(Objects::nonNull)
                    .filter(path -> !path.isBlank())
                    .forEach(videoPaths::add);
        }
        videoPaths.forEach(path -> scheduleDeleteAfterCommit(VIDEO_BUCKET, path));

        LinkedHashSet<String> docPaths = new LinkedHashSet<>();
        if (documents != null) {
            documents.stream()
                    .map(CourseDocument::getFileUrl)
                    .map(url -> extractPublicObjectPath(DOCS_BUCKET, url))
                    .filter(Objects::nonNull)
                    .filter(path -> !path.isBlank())
                    .forEach(docPaths::add);
        }
        docPaths.forEach(path -> scheduleDeleteAfterCommit(DOCS_BUCKET, path));
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private void deleteUploadedObjectOnRollback(String bucket, String path) {
        if (path == null || path.isBlank()) return;

        Runnable cleanup = () -> deleteObjectQuietly(bucket, path);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) {
                    cleanup.run();
                }
            }
        });
    }

    private void scheduleDeleteAfterCommit(String bucket, String path) {
        if (path == null || path.isBlank()) return;

        Runnable cleanup = () -> deleteObjectQuietly(bucket, path);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            cleanup.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                cleanup.run();
            }
        });
    }

    private void deleteObjectQuietly(String bucket, String path) {
        try {
            storageClient.delete(bucket, path);
        } catch (RuntimeException ex) {
            log.warn("Không thể cleanup storage object {}/{}: {}", bucket, path, ex.getMessage());
        }
    }

    private String extractPublicObjectPath(String bucket, String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) return null;
        String marker = "/storage/v1/object/public/" + bucket + "/";
        int markerIndex = publicUrl.indexOf(marker);
        if (markerIndex >= 0) {
            return publicUrl.substring(markerIndex + marker.length());
        }
        if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
            return publicUrl;
        }
        log.warn("Không xác định được object path từ public URL: {}", publicUrl);
        return null;
    }

    private void validateFile(MultipartFile file, Set<String> allowedMime,
                               long maxBytes, String typeDesc, String sizeDesc) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui lòng chọn file để upload.");
        }
        String mime = file.getContentType();
        if (mime == null || !allowedMime.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận " + typeDesc + ".");
        }
        if (file.getSize() > maxBytes) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File không được vượt quá " + sizeDesc + ".");
        }
    }

    /**
     * Verify GV là owner của course.
     * Ném 403 nếu teacherId không khớp.
     */
    private void verifyOwner(Course course, UUID teacherId) {
        if (!course.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền upload nội dung cho khóa học này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }
    }

    /**
     * Lấy phần mở rộng file từ tên gốc.
     * Trả defaultExt nếu không xác định được (null, không có dấu chấm).
     */
    private String getExtension(String filename, String defaultExt) {
        if (filename == null || !filename.contains(".")) return defaultExt;
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    private String imageExtension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }
}
