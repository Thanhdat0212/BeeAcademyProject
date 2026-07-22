package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.request.ConfirmDocumentUploadRequest;
import com.beeacademy.backend.dto.request.ConfirmUploadRequest;
import com.beeacademy.backend.dto.request.ConfirmVideoUploadRequest;
import com.beeacademy.backend.dto.request.SignedUploadRequest;
import com.beeacademy.backend.dto.response.SignedUploadResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Xử lý upload nội dung khóa học lên Supabase Storage (Phase 2).
 *
 * <p>Hai loại bucket:
 * <ul>
 *   <li>{@code course-videos} — PRIVATE. Video phải được truy cập qua
 *       signed URL (TTL 1 giờ). Lưu {@code storagePath}, không lưu URL.</li>
 *   <li>{@code course-documents} — PRIVATE. PDF/slide chỉ được tải qua
 *       one-time download link do UC15 cấp.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentUploadService {

    private static final String VIDEO_BUCKET = "course-videos";
    private static final String DOCS_BUCKET  = "course-documents";
    private static final String PUBLIC_ASSET_BUCKET = "course-docs";
    private static final String THUMBNAIL_BUCKET = PUBLIC_ASSET_BUCKET;
    private static final String QUESTION_ASSET_BUCKET = PUBLIC_ASSET_BUCKET;

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
    private static final Set<String> ALLOWED_QUESTION_IMAGE_MIME = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp");
    private static final Set<String> ALLOWED_QUESTION_AUDIO_MIME = Set.of(
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
            "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/m4a");
    private static final Set<String> ALLOWED_QUESTION_IMAGE_EXT = Set.of(
            "jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_QUESTION_AUDIO_EXT = Set.of(
            "mp3", "wav", "ogg", "m4a", "aac");

    private static final Set<String> ALLOWED_SUBMISSION_MIME = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "image/jpeg", "image/png", "image/webp");

    private static final long MAX_VIDEO_BYTES = 2L * 1024 * 1024 * 1024; // 2 GB
    private static final long MAX_DOC_BYTES   = 100L * 1024 * 1024;      // 100 MB
    private static final long MAX_SUBMISSION_BYTES = 25L * 1024 * 1024;  // UC16: 25 MB
    private static final long MAX_THUMBNAIL_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final long MAX_QUESTION_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final long MAX_QUESTION_AUDIO_BYTES = 20L * 1024 * 1024;

    // Không cho phép dấu chấm ở giữa path → chặn "../" thoát ra khỏi thư mục được cấp vé.
    private static final Pattern SAFE_OBJECT_PATH = Pattern.compile("^[0-9a-zA-Z/_-]+\\.[a-z0-9]{1,8}$");
    private static final Pattern SAFE_EXTENSION   = Pattern.compile("^[a-z0-9]{1,8}$");

    private final SupabaseStorageClient  storageClient;
    private final CourseRepository       courseRepository;
    private final LessonRepository       lessonRepository;
    private final CourseDocumentRepository documentRepository;
    private final JdbcTemplate           jdbcTemplate;
    private final ObjectMapper           objectMapper;

    // ========================================================================
    // Video upload (Phase 2)
    // ========================================================================

    /**
     * Cấp vé cho browser upload video bài giảng THẲNG lên Supabase.
     *
     * <p>Backend chỉ kiểm tra quyền rồi ký URL — không nhận byte nào của file.
     * Trước đây video 2GB đi xuyên qua Spring, chiếm thread và RAM của server
     * suốt vài phút; giờ luồng byte đi thẳng từ máy giáo viên tới Storage.
     *
     * <p>Path = {@code {courseId}/{chapterId}/{lessonId}/{uuid}.ext} do backend
     * quyết định, client không được chọn — đây là thứ chặn việc ghi đè file của
     * khóa học khác.
     */
    @Transactional(readOnly = true)
    public SignedUploadResponse createVideoUploadTicket(UUID courseId, UUID chapterId,
                                                        UUID lessonId, UUID teacherId,
                                                        SignedUploadRequest request) {
        validateDeclaredFile(request, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES,
                             "video MP4, WebM hoặc QuickTime", "2GB");

        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        verifyOwner(course, teacherId);
        lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        String path = courseId + "/" + chapterId + "/" + lessonId + "/"
                + UUID.randomUUID() + "." + safeExtension(request.filename(), "mp4");
        String uploadUrl = storageClient.createSignedUploadUrl(VIDEO_BUCKET, path);

        log.info("Cấp vé upload video: bucket={} path={}", VIDEO_BUCKET, path);
        return new SignedUploadResponse(uploadUrl, path);
    }

    /**
     * Ghi nhận video mà browser vừa upload xong vào bài giảng.
     *
     * <p>Kích thước và MIME client khai lúc xin vé chỉ là lời khai, nên ở đây
     * phải hỏi lại Supabase metadata thật trước khi lưu DB.
     *
     * @return UploadResponse với storagePath (không có publicUrl — private bucket)
     */
    @Transactional
    public UploadResponse confirmVideoUpload(UUID courseId, UUID chapterId, UUID lessonId,
                                             UUID teacherId, ConfirmVideoUploadRequest request) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        verifyOwner(course, teacherId);

        // BUG FIX: dùng LessonRepository thay vì stream filter toàn bộ collection
        // — tránh load hàng trăm bài giảng vào memory chỉ để tìm 1 lesson
        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        String path = requireObjectPathUnder(request.storagePath(),
                courseId + "/" + chapterId + "/" + lessonId);
        // Đăng ký trước khi kiểm tra: file sai loại/quá lớn sẽ bị xoá khi tx rollback,
        // không để lại rác chiếm quota Storage.
        deleteUploadedObjectOnRollback(VIDEO_BUCKET, path);
        var stat = requireUploadedObject(VIDEO_BUCKET, path, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES,
                                         "video MP4, WebM hoặc QuickTime", "2GB");

        String oldPath = lesson.getVideoStoragePath();
        // Lưu kèm duration do trình duyệt đọc từ metadata video trước khi upload.
        int normalizedDuration = request.durationSec() != null && request.durationSec() > 0
                ? request.durationSec() : 0;
        lesson.setVideoStoragePath(path, normalizedDuration);
        // BUG FIX: save lesson trực tiếp thay vì save cả Course aggregate
        // — tránh dirty-check toàn bộ chapters/lessons không liên quan
        lessonRepository.save(lesson);
        auditContentChange(courseId, lessonId, "UPLOAD_VIDEO", "MAJOR", teacherId,
                null, lessonAuditSnapshot(lesson));
        deleteVideoAfterCommit(oldPath);

        log.info("Ghi nhận video thành công: bucket={} path={} size={}",
                 VIDEO_BUCKET, path, stat.size());
        return new UploadResponse(path, null, stat.mimetype(), stat.size());
    }

    // ========================================================================
    // Document upload (Phase 2)
    // ========================================================================

    /**
     * Cấp vé cho browser upload tài liệu (PDF/slide) thẳng lên private bucket.
     *
     * <p>SECURITY: verify GV là chủ lesson NGAY TỪ BƯỚC KÝ — không cấp vé thì
     * client không có cách nào ghi vào bucket.
     */
    @Transactional(readOnly = true)
    public SignedUploadResponse createDocumentUploadTicket(UUID lessonId, UUID teacherId,
                                                           SignedUploadRequest request) {
        validateDeclaredFile(request, ALLOWED_DOC_MIME, MAX_DOC_BYTES,
                             "PDF, PPTX hoặc DOCX", "100MB");
        requireLessonOwnedBy(lessonId, teacherId);

        // Path dùng randomUUID để tránh ghi đè khi upload nhiều file cùng lesson
        String path = lessonId + "/" + UUID.randomUUID() + "."
                + safeExtension(request.filename(), "pdf");
        String uploadUrl = storageClient.createSignedUploadUrl(DOCS_BUCKET, path);

        log.info("Cấp vé upload tài liệu: lessonId={} path={}", lessonId, path);
        return new SignedUploadResponse(uploadUrl, path);
    }

    /**
     * Lưu metadata tài liệu mà browser vừa upload xong.
     *
     * <p>BUG FIX so với phiên bản cũ:
     * <ol>
     *   <li>Thêm ownership check: verify GV là chủ lesson trước khi upload.</li>
     *   <li>Lưu CourseDocument entity vào DB sau khi upload thành công
     *       — trước đây chỉ trả URL, không persist → reload trang là mất dữ liệu.</li>
     * </ol>
     *
     * @return UploadResponse không chứa public URL
     */
    @Transactional
    public UploadResponse confirmDocumentUpload(UUID lessonId, UUID teacherId,
                                                ConfirmDocumentUploadRequest request) {
        // SECURITY FIX: verify GV là chủ lesson trước khi cho phép upload.
        // Trước đây không có check này → bất kỳ GV nào cũng upload được vào lesson của người khác.
        Lesson lesson = requireLessonOwnedBy(lessonId, teacherId);

        String path = requireObjectPathUnder(request.storagePath(), lessonId.toString());
        deleteUploadedObjectOnRollback(DOCS_BUCKET, path);
        var stat = requireUploadedObject(DOCS_BUCKET, path, ALLOWED_DOC_MIME, MAX_DOC_BYTES,
                                         "PDF, PPTX hoặc DOCX", "100MB");

        String displayName    = request.name();
        String documentSlot   = request.slot();
        String fileType       = safeExtension(path, "pdf");

        // DATA FIX: lưu CourseDocument vào DB để lesson detail có thể load lại được.
        // Hai vị trí cố định giúp frontend phân biệt tài liệu và slide sau khi reload.
        // Giữ fallback đếm tăng dần để tương thích với client cũ chưa gửi slot.
        int position = switch (documentSlot == null ? "" : documentSlot.trim().toLowerCase()) {
            case "pdf" -> 1;
            case "slide" -> 2;
            default -> documentRepository.countByLessonId(lessonId) + 1;
        };
        String name   = (displayName != null && !displayName.isBlank())
                        ? displayName.trim()
                        : path.substring(path.lastIndexOf('/') + 1);
        CourseDocument doc = CourseDocument.create(lesson, name, null, path, DOCS_BUCKET,
                                                   fileType, stat.size(), position);
        documentRepository.save(doc);
        Course course = lesson.getChapter().getCourse();
        auditContentChange(course.getId(), lessonId, "UPLOAD_DOCUMENT", "MINOR", teacherId,
                null, documentAuditSnapshot(doc));

        log.info("Ghi nhận tài liệu private thành công: lessonId={} path={}", lessonId, path);
        return new UploadResponse(path, null, fileType, stat.size());
    }

    /**
     * Upload file bài làm của học sinh (UC16) lên public bucket.
     * Enrollment check thực hiện ở AssignmentService.verifyCanSubmit trước khi gọi.
     */
    @Transactional
    public UploadResponse uploadAssignmentFile(UUID assignmentId, UUID studentId,
                                                MultipartFile file) {
        validateFile(file, ALLOWED_SUBMISSION_MIME, MAX_SUBMISSION_BYTES,
                     "PDF, DOCX, PPTX hoặc ảnh JPEG/PNG/WEBP", "25MB");

        String ext  = getExtension(file.getOriginalFilename(), "pdf");
        String path = "assignment-submissions/" + assignmentId + "/" + studentId + "/"
                + UUID.randomUUID() + "." + ext;

        String publicUrl = storageClient.upload(DOCS_BUCKET, path,
                                                file.getContentType(), file.getResource(), file.getSize());

        log.info("Upload file bài làm thành công: assignmentId={} studentId={} path={}",
                 assignmentId, studentId, path);
        return new UploadResponse(path, publicUrl, ext, file.getSize());
    }

    /** Xóa đúng tài liệu theo id sau khi xác minh giáo viên sở hữu bài giảng. */
    @Transactional
    public void deleteDocument(UUID lessonId, UUID documentId, UUID teacherId) {
        CourseDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseDocument", documentId));
        Lesson lesson = document.getLesson();

        if (!lesson.getId().equals(lessonId)) {
            throw new ResourceNotFoundException("CourseDocument", documentId);
        }

        UUID lessonOwnerId = lesson.getChapter().getCourse().getTeacher().getId();
        if (!lessonOwnerId.equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền xóa tài liệu của bài giảng này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }

        Map<String, Object> before = documentAuditSnapshot(document);
        documentRepository.delete(document);
        deleteLessonFilesAfterCommit(List.of(), List.of(document));
        Course course = lesson.getChapter().getCourse();
        auditContentChange(course.getId(), lessonId, "DELETE_DOCUMENT", "MINOR", teacherId,
                before, null);
        log.info("Xóa tài liệu thành công: lessonId={} documentId={}", lessonId, documentId);
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

    /** Cấp vé upload video giới thiệu — cũng có thể tới 2GB nên không cho đi qua backend. */
    public SignedUploadResponse createIntroVideoUploadTicket(UUID teacherId,
                                                             SignedUploadRequest request) {
        validateDeclaredFile(request, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES,
                             "video MP4, WebM hoac QuickTime", "2GB");

        String path = "course-intros/" + teacherId + "/" + UUID.randomUUID() + "."
                + safeExtension(request.filename(), "mp4");
        String uploadUrl = storageClient.createSignedUploadUrl(PUBLIC_ASSET_BUCKET, path);

        log.info("Cap ve upload course intro video: teacherId={} path={}", teacherId, path);
        return new SignedUploadResponse(uploadUrl, path);
    }

    public UploadResponse confirmIntroVideoUpload(UUID teacherId, ConfirmUploadRequest request) {
        String path = requireObjectPathUnder(request.storagePath(), "course-intros/" + teacherId);
        var stat = requireUploadedObject(PUBLIC_ASSET_BUCKET, path, ALLOWED_VIDEO_MIME,
                                         MAX_VIDEO_BYTES, "video MP4, WebM hoac QuickTime", "2GB");
        String publicUrl = storageClient.publicUrl(PUBLIC_ASSET_BUCKET, path);

        log.info("Ghi nhan course intro video: teacherId={} path={} url={}",
                 teacherId, path, publicUrl);
        return new UploadResponse(path, publicUrl, stat.mimetype(), stat.size());
    }

    @Transactional
    public UploadResponse uploadQuestionImage(UUID teacherId, MultipartFile file) {
        validateFileByMimeOrExtension(file,
                ALLOWED_QUESTION_IMAGE_MIME, ALLOWED_QUESTION_IMAGE_EXT, MAX_QUESTION_IMAGE_BYTES,
                "anh JPEG, PNG hoac WEBP", "5MB");

        String contentType = normalizeQuestionImageContentType(file);
        String ext = imageExtension(contentType);
        String path = "question-assets/" + teacherId + "/images/" + UUID.randomUUID() + "." + ext;
        String publicUrl = storageClient.upload(QUESTION_ASSET_BUCKET, path,
                contentType, file.getResource(), file.getSize());

        log.info("Upload question image thanh cong: teacherId={} path={} url={}",
                teacherId, path, publicUrl);
        return new UploadResponse(path, publicUrl, contentType, file.getSize());
    }

    @Transactional
    public UploadResponse uploadQuestionAudio(UUID teacherId, MultipartFile file) {
        validateFileByMimeOrExtension(file,
                ALLOWED_QUESTION_AUDIO_MIME, ALLOWED_QUESTION_AUDIO_EXT, MAX_QUESTION_AUDIO_BYTES,
                "audio MP3, WAV, OGG, M4A hoac AAC", "20MB");

        String contentType = normalizeQuestionAudioContentType(file);
        String ext = audioExtension(contentType, file.getOriginalFilename());
        String path = "question-assets/" + teacherId + "/audio/" + UUID.randomUUID() + "." + ext;
        String publicUrl = storageClient.upload(QUESTION_ASSET_BUCKET, path,
                contentType, file.getResource(), file.getSize());

        log.info("Upload question audio thanh cong: teacherId={} path={} url={}",
                teacherId, path, publicUrl);
        return new UploadResponse(path, publicUrl, contentType, file.getSize());
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

        LinkedHashSet<String> docObjects = new LinkedHashSet<>();
        if (documents != null) {
            documents.stream()
                    .map(this::documentStorageObject)
                    .filter(Objects::nonNull)
                    .forEach(docObjects::add);
        }
        docObjects.forEach(object -> {
            int separator = object.indexOf('|');
            scheduleDeleteAfterCommit(object.substring(0, separator), object.substring(separator + 1));
        });
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

    private String documentStorageObject(CourseDocument document) {
        String bucket = document.getStorageBucket();
        String path = document.getStoragePath();
        if (bucket == null || bucket.isBlank()) bucket = PUBLIC_ASSET_BUCKET;
        if (path == null || path.isBlank()) {
            path = extractPublicObjectPath(PUBLIC_ASSET_BUCKET, document.getFileUrl());
        }
        return path == null || path.isBlank() ? null : bucket + "|" + path;
    }

    private Map<String, Object> lessonAuditSnapshot(Lesson lesson) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", lesson.getId());
        row.put("title", lesson.getTitle());
        row.put("videoStoragePath", lesson.getVideoStoragePath());
        row.put("hlsPlaylistUrl", lesson.getHlsPlaylistUrl());
        row.put("videoProcessingStatus", lesson.getVideoProcessingStatus());
        row.put("originalVideoRetentionUntil", lesson.getOriginalVideoRetentionUntil());
        row.put("durationSec", lesson.getDurationSec());
        return row;
    }

    private Map<String, Object> documentAuditSnapshot(CourseDocument document) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", document.getId());
        row.put("lessonId", document.getLesson() != null ? document.getLesson().getId() : null);
        row.put("name", document.getName());
        row.put("fileType", document.getFileType());
        row.put("storageBucket", document.getStorageBucket());
        row.put("storagePath", document.getStoragePath());
        row.put("fileSizeBytes", document.getFileSizeBytes());
        row.put("position", document.getPosition());
        return row;
    }

    private void auditContentChange(UUID courseId, UUID lessonId, String action,
                                    String changeType, UUID actorId,
                                    Map<String, Object> before, Map<String, Object> after) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO public.course_content_audit_logs
                    (course_id, entity_type, entity_id, action, change_type, actor_id, before_state, after_state)
                    VALUES (?, 'LESSON', ?, ?, ?, ?, ?::jsonb, ?::jsonb)
                    """,
                    courseId, lessonId, action, changeType, actorId,
                    toJsonOrNull(before), toJsonOrNull(after));
        } catch (Exception ex) {
            log.warn("Could not write upload audit log course={} lesson={} action={}",
                    courseId, lessonId, action, ex);
        }
    }

    private String toJsonOrNull(Map<String, Object> payload) {
        if (payload == null) return null;
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{}";
        }
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

    /**
     * Kiểm tra lời khai của client trước khi cấp vé upload.
     *
     * <p>Chỉ để từ chối sớm cho đỡ tốn công upload — không phải hàng rào bảo mật,
     * vì client có thể khai sai. Hàng rào thật là {@link #requireUploadedObject}
     * cộng với giới hạn MIME/size cấu hình ngay trên bucket Supabase.
     */
    private void validateDeclaredFile(SignedUploadRequest request, Set<String> allowedMime,
                                      long maxBytes, String typeDesc, String sizeDesc) {
        String mime = request.contentType() == null ? "" : request.contentType().trim().toLowerCase();
        if (!allowedMime.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận " + typeDesc + ".");
        }
        if (request.sizeBytes() > maxBytes) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File không được vượt quá " + sizeDesc + ".");
        }
    }

    /**
     * Chặn client trỏ bừa sang object của người khác khi gọi confirm.
     *
     * <p>Path phải nằm đúng trong thư mục mà backend đã cấp vé, và không được
     * chứa ký tự lạ — pattern loại luôn dấu chấm ở giữa nên {@code ../} không lọt.
     */
    private String requireObjectPathUnder(String storagePath, String requiredPrefix) {
        String path = storagePath == null ? "" : storagePath.trim();
        if (!SAFE_OBJECT_PATH.matcher(path).matches()
                || !path.startsWith(requiredPrefix + "/")) {
            throw new BusinessException("INVALID_STORAGE_PATH",
                    "Đường dẫn tệp không hợp lệ.");
        }
        return path;
    }

    /** Hỏi Supabase metadata thật của object vừa upload và đối chiếu với giới hạn. */
    private SupabaseStorageClient.ObjectStat requireUploadedObject(
            String bucket, String path, Set<String> allowedMime, long maxBytes,
            String typeDesc, String sizeDesc) {
        SupabaseStorageClient.ObjectStat stat = storageClient.statObject(bucket, path);
        if (stat == null) {
            throw new BusinessException("UPLOAD_NOT_FOUND",
                    "Không tìm thấy tệp vừa tải lên. Vui lòng tải lại.");
        }
        if (stat.size() != null && stat.size() > maxBytes) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File không được vượt quá " + sizeDesc + ".");
        }
        if (stat.mimetype() != null
                && !allowedMime.contains(stat.mimetype().trim().toLowerCase())) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận " + typeDesc + ".");
        }
        return stat;
    }

    private Lesson requireLessonOwnedBy(UUID lessonId, UUID teacherId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        // Lazy load: lesson.getChapter().getCourse() — OK vì đang trong @Transactional
        UUID lessonOwnerId = lesson.getChapter().getCourse().getTeacher().getId();
        if (!lessonOwnerId.equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền upload tài liệu cho bài giảng này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }
        return lesson;
    }

    /** Phần mở rộng đã lọc sạch — tên file do client gửi không được lọt vào object path. */
    private String safeExtension(String filename, String defaultExt) {
        String ext = getExtension(filename, defaultExt);
        return SAFE_EXTENSION.matcher(ext).matches() ? ext : defaultExt;
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
    private void validateFileByMimeOrExtension(MultipartFile file,
                                               Set<String> allowedMime,
                                               Set<String> allowedExtensions,
                                               long maxBytes, String typeDesc,
                                               String sizeDesc) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui lòng chọn file để upload.");
        }
        String mime = file.getContentType() == null ? "" : file.getContentType().trim().toLowerCase();
        String ext = getExtension(file.getOriginalFilename(), "").toLowerCase();
        boolean mimeAllowed = !mime.isBlank() && allowedMime.contains(mime);
        boolean extAllowed = !ext.isBlank() && allowedExtensions.contains(ext);
        if (!mimeAllowed && !extAllowed) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận " + typeDesc + ".");
        }
        if (file.getSize() > maxBytes) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File không được vượt quá " + sizeDesc + ".");
        }
    }

    private String getExtension(String filename, String defaultExt) {
        if (filename == null || !filename.contains(".")) return defaultExt;
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    private String normalizeQuestionImageContentType(MultipartFile file) {
        String mime = file.getContentType() == null ? "" : file.getContentType().trim().toLowerCase();
        if (!mime.isBlank()) {
            if ("image/jpg".equals(mime)) return "image/jpeg";
            return mime;
        }
        return switch (getExtension(file.getOriginalFilename(), "").toLowerCase()) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> "image/jpeg";
        };
    }

    private String normalizeQuestionAudioContentType(MultipartFile file) {
        String mime = file.getContentType() == null ? "" : file.getContentType().trim().toLowerCase();
        if (!mime.isBlank()) {
            if ("audio/m4a".equals(mime)) return "audio/x-m4a";
            return mime;
        }
        return switch (getExtension(file.getOriginalFilename(), "").toLowerCase()) {
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "ogg" -> "audio/ogg";
            case "m4a" -> "audio/x-m4a";
            case "aac" -> "audio/aac";
            default -> "audio/mpeg";
        };
    }

    private String imageExtension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    private String audioExtension(String contentType, String originalFilename) {
        return switch (contentType) {
            case "audio/mpeg", "audio/mp3" -> "mp3";
            case "audio/wav", "audio/x-wav" -> "wav";
            case "audio/ogg" -> "ogg";
            case "audio/mp4", "audio/x-m4a" -> "m4a";
            case "audio/aac" -> "aac";
            default -> getExtension(originalFilename, "mp3");
        };
    }
}
