package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateChapterRequest;
import com.beeacademy.backend.dto.request.CreateCourseRequest;
import com.beeacademy.backend.dto.request.CreateLessonRequest;
import com.beeacademy.backend.dto.request.ReorderChaptersRequest;
import com.beeacademy.backend.dto.request.ReorderItemRequest;
import com.beeacademy.backend.dto.request.ReorderLessonsRequest;
import com.beeacademy.backend.dto.request.UpdateChapterRequest;
import com.beeacademy.backend.dto.request.UpdateCourseRequest;
import com.beeacademy.backend.dto.request.UpdateLessonRequest;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.TeacherChapterResponse;
import com.beeacademy.backend.dto.response.TeacherCourseDetailResponse;
import com.beeacademy.backend.dto.response.TeacherCourseResponse;
import com.beeacademy.backend.dto.response.TeacherLessonResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ApprovalHistory;
import com.beeacademy.backend.model.AdminNotification;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.AdminNotificationRepository;
import com.beeacademy.backend.repository.ApprovalHistoryRepository;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseContentCount;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Nghiệp vụ quản lý khóa học phía Giáo viên (Phase 1 — CRUD, không upload).
 *
 * <p>Thiết kế: mỗi thao tác thêm/sửa/xóa Chapter và Lesson sử dụng
 * {@link ChapterRepository} và {@link LessonRepository} trực tiếp thay vì
 * mutate collection của Course aggregate. Lý do:
 * <ul>
 *   <li>{@code Course.getChapters()} trả unmodifiableList → không thể add/remove.</li>
 *   <li>Sử dụng repository trực tiếp rõ ràng hơn và tránh N+1 khi không cần
 *       load toàn bộ chapters.</li>
 * </ul>
 *
 * <p>Nguyên tắc phân quyền:
 * <ul>
 *   <li>GV chỉ thao tác được khóa học của chính mình (verify teacherId).</li>
 *   <li>Chỉ sửa nội dung khi status ∈ {DRAFT, NEEDS_REVISION}.</li>
 *   <li>Submit: DRAFT/NEEDS_REVISION → PENDING_REVIEW.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeacherCourseService {

    private final CourseRepository          courseRepository;
    private final CategoryRepository        categoryRepository;
    private final ProfileRepository         profileRepository;
    private final ChapterRepository         chapterRepository;
    private final LessonRepository          lessonRepository;
    private final CourseDocumentRepository  documentRepository;
    private final EnrollmentRepository      enrollmentRepository;
    private final ApprovalHistoryRepository approvalHistoryRepository;
    private final CourseVersionRepository   courseVersionRepository;
    private final AdminNotificationRepository notificationRepository;
    private final ContentUploadService      contentUploadService;
    private final ObjectMapper              objectMapper;

    // ========================================================================
    // Course CRUD
    // ========================================================================

    /**
     * Tạo khóa học mới ở trạng thái DRAFT.
     * Slug tự động sinh từ title, đảm bảo unique bằng suffix số.
     */
    @Transactional
    public TeacherCourseResponse createCourse(AuthenticatedUser me,
                                               CreateCourseRequest req) {
        Profile  teacher  = loadProfile(me.userId());
        Category category = loadCategory(req.categoryId());

        // Validate: giá gốc trong khoảng 99.000–1.000.000₫ (UseCase v6.5)
        validatePrice(req.priceVnd());
        // Validate: giá khuyến mãi phải nhỏ hơn giá gốc (cross-field validation)
        validateSalePrice(req.salePriceVnd(), req.priceVnd());
        validateThumbnailUrl(req.thumbnailUrl());
        validateIntroVideoUrl(req.introVideoUrl());

        int[] grades = req.grades().stream().mapToInt(Integer::intValue).toArray();
        Course course = Course.createByTeacher(teacher, req.title(), req.description(),
                                               trimToNull(req.objective()),
                                               trimToNull(req.audience()),
                                               category, grades, req.priceVnd());

        // Đảm bảo slug unique: thêm suffix -2, -3... nếu đã tồn tại
        String baseSlug = course.getSlug();
        String slug = baseSlug;
        int suffix = 2;
        while (courseRepository.findBySlug(slug).isPresent()) {
            slug = baseSlug + "-" + suffix++;
        }

        // Gán salePriceVnd nếu có (factory không nhận field này).
        // Truyền priceVnd=0 vì Course.update() có guard "if (priceVnd > 0)" —
        // 0 sẽ không ghi đè priceVnd đã được set bởi factory ở trên.
        // KHÔNG truyền null vì priceVnd là primitive int — sẽ gây NullPointerException khi unbox.
        if (req.salePriceVnd() != null) {
            course.update(null, null, null, null, 0, req.salePriceVnd(), null,
                          null, null, null);
        }
        if (req.thumbnailUrl() != null && !req.thumbnailUrl().isBlank()) {
            course.setThumbnailUrl(req.thumbnailUrl().trim());
        }
        if (req.introVideoUrl() != null && !req.introVideoUrl().isBlank()) {
            course.setIntroVideoUrl(req.introVideoUrl());
        }

        Course saved = courseRepository.save(course);
        log.info("GV {} tạo khóa học '{}' ({})", me.userId(), saved.getTitle(), saved.getId());
        return TeacherCourseResponse.fromEntity(saved);
    }

    /** Danh sách khóa học của GV, sắp xếp theo updatedAt DESC. */
    @Transactional
    public PageResponse<TeacherCourseResponse> listMyCourses(AuthenticatedUser me,
                                                               Pageable pageable) {
        Specification<Course> spec = (root, q, cb) ->
                cb.equal(root.get("teacher").get("id"), me.userId());
        Page<Course> page = courseRepository.findAll(spec, pageable);
        List<Course> courses = page.getContent();
        Map<UUID, Integer> chapterCounts = loadChapterCounts(courses);
        Map<UUID, Integer> lessonCounts = loadLessonCounts(courses);
        syncCourseCounters(courses, chapterCounts, lessonCounts);

        List<TeacherCourseResponse> items = courses.stream()
                .map(c -> TeacherCourseResponse.fromEntity(
                        c,
                        enrollmentRepository.countByCourseId(c.getId()),
                        chapterCounts.getOrDefault(c.getId(), 0),
                        lessonCounts.getOrDefault(c.getId(), 0)))
                .toList();

        return new PageResponse<>(
                items,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext());
    }

    /** Chi tiết khóa học + chapters + lessons + lịch sử duyệt. */
    @Transactional
    public TeacherCourseDetailResponse getCourseDetail(UUID courseId, AuthenticatedUser me) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(courseId);
        syncCourseCounters(course, chapters.size(), countLessons(chapters));
        List<ApprovalHistory> history =
                approvalHistoryRepository.findByCourseIdOrderByCreatedAtAsc(courseId);
        List<CourseVersion> versions =
                courseVersionRepository.findByCourseIdOrderByVersionNoDesc(courseId);
        return TeacherCourseDetailResponse.fromEntity(
                course, history, enrollmentRepository.countByCourseId(courseId), chapters, versions);
    }

    /** Cập nhật thông tin cơ bản (chỉ khi DRAFT/NEEDS_REVISION). */
    @Transactional
    public TeacherCourseResponse updateCourse(UUID courseId, AuthenticatedUser me,
                                               UpdateCourseRequest req) {
        Course   course   = loadAndVerifyOwner(courseId, me.userId());
        assertCourseInfoEditable(course);

        // Tính giá hiệu dụng sau khi update để validate cross-field
        Integer effectivePrice     = req.priceVnd()     != null ? req.priceVnd()     : course.getPriceVnd();
        // BUG FIX: null trong request = "giữ nguyên giá KM cũ", KHÔNG phải "xóa giá KM".
        // Để xóa giá KM, frontend gửi clearSalePrice=true hoặc salePriceVnd=0.
        Integer effectiveSalePrice = req.salePriceVnd() != null ? req.salePriceVnd() : course.getSalePriceVnd();

        // Validate: giá gốc trong khoảng 99.000–1.000.000₫ (UseCase v6.5)
        validatePrice(effectivePrice);
        // Validate: giá khuyến mãi phải nhỏ hơn giá gốc (sau khi tính giá hiệu dụng)
        validateSalePrice(effectiveSalePrice, effectivePrice);
        validateThumbnailUrl(req.thumbnailUrl());
        validateIntroVideoUrl(req.introVideoUrl());

        Category category = req.categoryId() != null ? loadCategory(req.categoryId()) : null;
        int[] grades = req.grades() != null
                ? req.grades().stream().mapToInt(Integer::intValue).toArray() : null;

        course.update(req.title(), req.description(), category,
                      grades,
                      effectivePrice,
                      effectiveSalePrice,
                      req.thumbnailUrl(),
                      req.objective(),
                      req.audience(),
                      req.introVideoUrl());
        Course saved = courseRepository.save(course);
        return TeacherCourseResponse.fromEntity(saved, enrollmentRepository.countByCourseId(saved.getId()));
    }

    /** Xóa khóa học — chỉ khi DRAFT. */
    @Transactional
    public void deleteCourse(UUID courseId, AuthenticatedUser me) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        if (course.getStatus() != CourseStatus.DRAFT) {
            throw new BusinessException("CANNOT_DELETE",
                    "Chỉ có thể xóa khóa học ở trạng thái Bản nháp.");
        }
        List<Lesson> lessons = loadLessonsForCourse(courseId);
        List<CourseDocument> documents = loadDocumentsForLessons(lessons);
        documentRepository.deleteAll(documents);
        courseRepository.delete(course);
        contentUploadService.deleteLessonFilesAfterCommit(lessons, documents);
        log.info("GV {} xóa khóa học {}", me.userId(), courseId);
    }

    /** Nộp khóa học để Admin duyệt. */
    @Transactional
    public TeacherCourseResponse submitForReview(UUID courseId, AuthenticatedUser me) {
        Course course = loadAndVerifyOwner(courseId, me.userId());

        // BUG FIX: load chapters một lần duy nhất — trước đây query 2 lần cùng một kết quả
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(courseId);

        // Validate: khóa học phải có ít nhất 1 chương
        if (chapters.isEmpty()) {
            throw new BusinessException("EMPTY_COURSE",
                    "Khóa học phải có ít nhất 1 chương trước khi nộp duyệt.");
        }

        // Validate: mỗi chương phải có ít nhất 1 bài giảng
        boolean anyLessonless = chapters.stream()
                .anyMatch(ch -> ch.getLessons().isEmpty());
        if (anyLessonless) {
            throw new BusinessException("EMPTY_CHAPTER",
                    "Mỗi chương phải có ít nhất 1 bài giảng.");
        }

        int nextVersion = courseVersionRepository.findMaxVersionNo(courseId) + 1;
        course.markSubmittedVersion(nextVersion);
        course.submitForReview();
        Course saved = courseRepository.save(course);
        courseVersionRepository.save(CourseVersion.create(
                saved, saved.getTeacher(), nextVersion, buildCourseSnapshotJson(saved, chapters)));
        notificationRepository.save(AdminNotification.courseSubmitted(saved, saved.getTeacher()));
        log.info("GV {} nộp khóa học {} để duyệt", me.userId(), courseId);
        return TeacherCourseResponse.fromEntity(saved, enrollmentRepository.countByCourseId(saved.getId()));
    }

    // ========================================================================
    // Chapter CRUD
    // Dùng ChapterRepository trực tiếp — KHÔNG mutate Course.chapters (unmodifiable).
    // ========================================================================

    @Transactional
    public TeacherChapterResponse addChapter(UUID courseId, AuthenticatedUser me,
                                              CreateChapterRequest req) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Tính position tiếp theo nếu không truyền
        int nextPos = chapterRepository.findByCourseIdOrderByPositionAsc(courseId).size() + 1;
        int position = req.position() != null ? req.position() : nextPos;

        Chapter chapter = Chapter.createNew(course, req.title(), req.description(), position);
        Chapter saved   = chapterRepository.save(chapter);
        refreshCourseCounts(courseId);
        log.info("Thêm chương '{}' vào khóa học {}", req.title(), courseId);
        return TeacherChapterResponse.fromEntity(saved);
    }

    @Transactional
    public TeacherChapterResponse updateChapter(UUID courseId, UUID chapterId,
                                                 AuthenticatedUser me,
                                                 UpdateChapterRequest req) {
        // loadAndVerifyOwner trả Course đã load — dùng lại để assertEditable,
        // không cần courseRepository.findById() lần 2 (tránh 1 DB round-trip thừa).
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify chapter thuộc đúng courseId (tránh chỉnh sửa chapter của GV khác)
        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        chapter.update(req.title(), req.description(), req.position());
        return TeacherChapterResponse.fromEntity(chapterRepository.save(chapter));
    }

    @Transactional
    public void deleteChapter(UUID courseId, UUID chapterId, AuthenticatedUser me) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify chapter thuộc courseId trước khi xóa (tránh xóa nhầm chapter của người khác)
        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        List<Lesson> lessons = lessonRepository.findByChapterIdOrderByPositionAsc(chapterId);
        List<CourseDocument> documents = loadDocumentsForLessons(lessons);
        documentRepository.deleteAll(documents);

        // CascadeType.ALL + orphanRemoval trên lessons → xóa lessons theo tự động
        chapterRepository.delete(chapter);
        contentUploadService.deleteLessonFilesAfterCommit(lessons, documents);
        refreshCourseCounts(courseId);
        log.info("Xóa chương {} khỏi khóa học {}", chapterId, courseId);
    }

    // ========================================================================
    // Lesson CRUD
    // Dùng LessonRepository trực tiếp — KHÔNG mutate Chapter.lessons (unmodifiable).
    // ========================================================================

    @Transactional
    public TeacherLessonResponse addLesson(UUID courseId, UUID chapterId,
                                            AuthenticatedUser me,
                                            CreateLessonRequest req) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        int nextPos = lessonRepository.countByChapterId(chapterId) + 1;
        int position = req.position() != null ? req.position() : nextPos;

        Lesson lesson = Lesson.createNew(chapter, req.title(), req.description(),
                                         position, req.isFree());
        if (req.videoEmbedUrl() != null && !req.videoEmbedUrl().isBlank()) {
            lesson.setVideoEmbedUrl(req.videoEmbedUrl());
        }

        Lesson saved = lessonRepository.save(lesson);
        refreshCourseCounts(courseId);
        log.info("Thêm bài giảng '{}' vào chương {}", req.title(), chapterId);
        return TeacherLessonResponse.fromEntity(saved);
    }

    @Transactional
    public TeacherLessonResponse updateLesson(UUID courseId, UUID chapterId,
                                               UUID lessonId, AuthenticatedUser me,
                                               UpdateLessonRequest req) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify ownership chain: lesson → chapter → course → teacher
        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        String oldVideoPath = lesson.getVideoStoragePath();
        String videoSource = normalizeVideoSource(req.videoSource());

        lesson.update(
                req.title(),
                req.description(),
                req.position(),
                req.isFree() != null ? req.isFree() : lesson.getIsFree());

        if ("embed".equals(videoSource)) {
            String embedUrl = trimToNull(req.videoEmbedUrl());
            if (embedUrl == null) {
                throw new BusinessException("INVALID_VIDEO_SOURCE",
                        "Vui lòng nhập URL YouTube/Vimeo khi chọn video nhúng.");
            }
            lesson.setVideoEmbedUrl(embedUrl);
            contentUploadService.deleteVideoAfterCommit(oldVideoPath);
        } else if ("none".equals(videoSource)) {
            lesson.clearVideo();
            contentUploadService.deleteVideoAfterCommit(oldVideoPath);
        } else if (videoSource == null && req.videoEmbedUrl() != null) {
            String embedUrl = trimToNull(req.videoEmbedUrl());
            if (embedUrl != null) {
                lesson.setVideoEmbedUrl(embedUrl);
                contentUploadService.deleteVideoAfterCommit(oldVideoPath);
            }
        }

        return TeacherLessonResponse.fromEntity(lessonRepository.save(lesson));
    }

    @Transactional
    public void deleteLesson(UUID courseId, UUID chapterId, UUID lessonId,
                              AuthenticatedUser me) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        List<CourseDocument> documents = documentRepository.findByLessonIdOrderByPositionAsc(lessonId);
        documentRepository.deleteAll(documents);
        lessonRepository.delete(lesson);
        contentUploadService.deleteLessonFilesAfterCommit(List.of(lesson), documents);
        refreshCourseCounts(courseId);
        log.info("Xóa bài giảng {} khỏi chương {}", lessonId, chapterId);
    }

    @Transactional
    public TeacherCourseDetailResponse reorderChapters(UUID courseId, AuthenticatedUser me,
                                                       ReorderChaptersRequest req) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        validateReorderIds(
                chapters.stream().map(Chapter::getId).collect(java.util.stream.Collectors.toSet()),
                req.chapters().stream().map(ReorderItemRequest::id).toList(),
                "Danh sách chương không khớp với khóa học hiện tại.");

        Map<UUID, Chapter> byId = chapters.stream()
                .collect(java.util.stream.Collectors.toMap(Chapter::getId, ch -> ch));
        List<ReorderItemRequest> ordered = req.chapters().stream()
                .sorted(Comparator.comparing(ReorderItemRequest::position))
                .toList();

        for (int i = 0; i < ordered.size(); i++) {
            byId.get(ordered.get(i).id()).update(null, null, i + 1);
        }
        chapterRepository.saveAll(chapters);
        return getCourseDetail(courseId, me);
    }

    @Transactional
    public TeacherCourseDetailResponse reorderLessons(UUID courseId, UUID chapterId,
                                                      AuthenticatedUser me,
                                                      ReorderLessonsRequest req) {
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        List<Lesson> lessons = lessonRepository.findByChapterIdOrderByPositionAsc(chapterId);
        validateReorderIds(
                lessons.stream().map(Lesson::getId).collect(java.util.stream.Collectors.toSet()),
                req.lessons().stream().map(ReorderItemRequest::id).toList(),
                "Danh sách bài giảng không khớp với chương hiện tại.");

        Map<UUID, Lesson> byId = lessons.stream()
                .collect(java.util.stream.Collectors.toMap(Lesson::getId, lesson -> lesson));
        List<ReorderItemRequest> ordered = req.lessons().stream()
                .sorted(Comparator.comparing(ReorderItemRequest::position))
                .toList();

        for (int i = 0; i < ordered.size(); i++) {
            Lesson lesson = byId.get(ordered.get(i).id());
            lesson.update(null, null, i + 1, Boolean.TRUE.equals(lesson.getIsFree()));
        }
        lessonRepository.saveAll(lessons);
        return getCourseDetail(courseId, me);
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private List<Lesson> loadLessonsForCourse(UUID courseId) {
        return chapterRepository.findWithLessonsByCourseId(courseId).stream()
                .flatMap(chapter -> chapter.getLessons().stream())
                .toList();
    }

    private List<CourseDocument> loadDocumentsForLessons(List<Lesson> lessons) {
        if (lessons == null || lessons.isEmpty()) return List.of();
        List<UUID> lessonIds = lessons.stream().map(Lesson::getId).toList();
        return documentRepository.findByLessonIdIn(lessonIds);
    }

    private String normalizeVideoSource(String videoSource) {
        if (videoSource == null || videoSource.isBlank()) return null;
        String normalized = videoSource.trim().toLowerCase();
        if (normalized.equals("upload") || normalized.equals("embed") || normalized.equals("none")) {
            return normalized;
        }
        throw new BusinessException("INVALID_VIDEO_SOURCE",
                "Nguồn video không hợp lệ. Chỉ chấp nhận upload, embed hoặc none.");
    }

    private void validateReorderIds(Set<UUID> expectedIds, List<UUID> requestedIds, String message) {
        Set<UUID> uniqueIds = new HashSet<>(requestedIds);
        if (requestedIds.size() != uniqueIds.size() || !expectedIds.equals(uniqueIds)) {
            throw new BusinessException("INVALID_REORDER", message);
        }
    }

    private void validateThumbnailUrl(String url) {
        if (url == null || url.isBlank()) return;
        String trimmed = url.trim();
        String lower = trimmed.toLowerCase();
        if (lower.matches(".*\\.(mp4|webm|mov)(\\?.*)?(#.*)?$")) {
            throw new BusinessException("INVALID_THUMBNAIL_URL",
                    "Ảnh bìa khóa học phải là ảnh, không dùng URL video giới thiệu.");
        }
    }

    private void validateIntroVideoUrl(String url) {
        if (url == null || url.isBlank()) return;
        String trimmed = url.trim();
        try {
            URI uri = new URI(trimmed);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                throw new BusinessException("INVALID_INTRO_VIDEO",
                        "URL video giới thiệu phải bắt đầu bằng http:// hoặc https://.");
            }
            if (host == null || host.isBlank()) {
                throw new BusinessException("INVALID_INTRO_VIDEO",
                        "URL video giới thiệu không hợp lệ.");
            }
            String lowerHost = host.toLowerCase();
            String lowerPath = uri.getPath() != null ? uri.getPath().toLowerCase() : "";
            boolean accepted = lowerHost.contains("youtube.com")
                    || lowerHost.contains("youtu.be")
                    || lowerHost.contains("vimeo.com")
                    || lowerPath.endsWith(".mp4")
                    || lowerPath.endsWith(".webm")
                    || lowerPath.endsWith(".mov");
            if (!accepted) {
                throw new BusinessException("INVALID_INTRO_VIDEO",
                        "Video giới thiệu chỉ hỗ trợ YouTube, Vimeo hoặc file MP4/WebM/MOV công khai.");
            }
        } catch (URISyntaxException e) {
            throw new BusinessException("INVALID_INTRO_VIDEO",
                    "URL video giới thiệu không hợp lệ.");
        }
    }

    private String buildCourseSnapshotJson(Course course, List<Chapter> chapters) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("courseId", course.getId());
        snapshot.put("versionNo", course.getSubmittedVersionNo());
        snapshot.put("slug", course.getSlug());
        snapshot.put("title", course.getTitle());
        snapshot.put("description", course.getDescription());
        snapshot.put("objective", course.getObjective());
        snapshot.put("audience", course.getAudience());
        snapshot.put("thumbnailUrl", course.getThumbnailUrl());
        snapshot.put("introVideoUrl", course.getIntroVideoUrl());
        snapshot.put("categoryId", course.getCategory() != null ? course.getCategory().getId() : null);
        snapshot.put("categoryName", course.getCategory() != null ? course.getCategory().getName() : null);
        snapshot.put("teacherId", course.getTeacher() != null ? course.getTeacher().getId() : null);
        snapshot.put("teacherName", course.getTeacher() != null ? course.getTeacher().getFullName() : null);
        snapshot.put("grades", java.util.Arrays.stream(course.getGrades()).boxed().toList());
        snapshot.put("priceVnd", course.getPriceVnd());
        snapshot.put("salePriceVnd", course.getSalePriceVnd());
        snapshot.put("status", course.getStatus().toDbValue());
        snapshot.put("totalChapters", chapters.size());
        snapshot.put("totalLessons", countLessons(chapters));
        snapshot.put("chapters", chapters.stream()
                .sorted(Comparator.comparing(Chapter::getPosition))
                .map(this::chapterSnapshot)
                .toList());
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new BusinessException("SNAPSHOT_FAILED",
                    "Không thể tạo phiên bản khóa học để nộp duyệt.");
        }
    }

    private Map<String, Object> chapterSnapshot(Chapter chapter) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", chapter.getId());
        row.put("title", chapter.getTitle());
        row.put("description", chapter.getDescription());
        row.put("position", chapter.getPosition());
        row.put("lessons", chapter.getLessons().stream()
                .sorted(Comparator.comparing(Lesson::getPosition))
                .map(this::lessonSnapshot)
                .toList());
        return row;
    }

    private Map<String, Object> lessonSnapshot(Lesson lesson) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", lesson.getId());
        row.put("title", lesson.getTitle());
        row.put("description", lesson.getDescription());
        row.put("position", lesson.getPosition());
        row.put("isFree", lesson.getIsFree());
        row.put("videoEmbedUrl", lesson.getVideoEmbedUrl());
        row.put("videoStoragePath", lesson.getVideoStoragePath());
        row.put("videoUrl", lesson.getVideoUrl());
        row.put("durationSec", lesson.getDurationSec());
        return row;
    }

    /**
     * Load course và verify GV là owner.
     * Ném 404 nếu không tồn tại, 403 nếu không phải owner.
     */
    private Course loadAndVerifyOwner(UUID courseId, UUID teacherId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (!course.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền chỉnh sửa khóa học này.", HttpStatus.FORBIDDEN);
        }
        return course;
    }

    /**
     * Chỉ cho phép edit khi status ∈ {DRAFT, NEEDS_REVISION, REJECTED}.
     *
     * <p>Các trạng thái cho phép sửa:
     * <ul>
     *   <li>DRAFT — khóa học mới tạo, chưa nộp.</li>
     *   <li>NEEDS_REVISION — Admin yêu cầu chỉnh sửa rồi nộp lại.</li>
     *   <li>REJECTED — Admin từ chối; GV cần chỉnh sửa rồi nộp lại qua draft mới.</li>
     * </ul>
     *
     * <p>Các trạng thái BỊ CHẶN:
     * <ul>
     *   <li>PENDING_REVIEW — đang chờ Admin duyệt, không được sửa.</li>
     *   <li>APPROVED — Admin đã duyệt, chờ publish.</li>
     *   <li>PUBLISHED — đang hiển thị cho học sinh, không sửa không qua duyệt.</li>
     *   <li>ARCHIVED — đã lưu trữ.</li>
     * </ul>
     */
    private void assertEditable(Course course) {
        CourseStatus s = course.getStatus();
        // Whitelist approach: chỉ cho phép khi status thuộc danh sách an toàn
        boolean editable = s == CourseStatus.DRAFT
                        || s == CourseStatus.NEEDS_REVISION
                        || s == CourseStatus.REJECTED;  // GV cần sửa sau khi bị từ chối
        if (!editable) {
            String statusLabel = switch (s) {
                case PENDING_REVIEW -> "Đang chờ duyệt";
                case APPROVED       -> "Đã duyệt (chờ publish)";
                case PUBLISHED      -> "Đã phát hành";
                case ARCHIVED       -> "Đã lưu trữ";
                default             -> s.toDbValue();
            };
            throw new BusinessException("NOT_EDITABLE",
                    "Không thể chỉnh sửa khi khóa học đang ở trạng thái '"
                    + statusLabel + "'.");
        }
    }

    /**
     * Chỉ cho phép cập nhật thông tin cơ bản khi status ∈ {DRAFT, NEEDS_REVISION, REJECTED}.
     *
     * <p>PENDING_REVIEW và PUBLISHED bị chặn để đảm bảo mọi thay đổi thông tin
     * (tiêu đề, giá, mô tả) đều phải qua workflow duyệt của Admin (UC36).
     * Nếu GV muốn chỉnh sửa khóa đang duyệt/đã phát hành, phải đặt về DRAFT trước.
     */
    private void assertCourseInfoEditable(Course course) {
        CourseStatus s = course.getStatus();
        boolean editable = s == CourseStatus.DRAFT
                        || s == CourseStatus.NEEDS_REVISION
                        || s == CourseStatus.REJECTED;
        if (!editable) {
            String statusLabel = switch (s) {
                case PENDING_REVIEW -> "Đang chờ duyệt";
                case APPROVED       -> "Đã duyệt (chờ publish)";
                case PUBLISHED      -> "Đã phát hành";
                case ARCHIVED       -> "Đã lưu trữ";
                default             -> s.toDbValue();
            };
            throw new BusinessException("NOT_EDITABLE",
                    "Không thể cập nhật thông tin khi khóa học đang ở trạng thái '"
                    + statusLabel + "'. Liên hệ Admin để hỗ trợ.");
        }
    }

    /**
     * Validate giá khuyến mãi phải nhỏ hơn giá gốc.
     * Bỏ qua nếu salePriceVnd = null (không áp dụng KM).
     */
    private Map<UUID, Integer> loadChapterCounts(List<Course> courses) {
        if (courses.isEmpty()) return new HashMap<>();
        List<UUID> courseIds = courses.stream().map(Course::getId).toList();
        return toCountMap(chapterRepository.countByCourseIds(courseIds));
    }

    private Map<UUID, Integer> loadLessonCounts(List<Course> courses) {
        if (courses.isEmpty()) return new HashMap<>();
        List<UUID> courseIds = courses.stream().map(Course::getId).toList();
        return toCountMap(lessonRepository.countByCourseIds(courseIds));
    }

    private Map<UUID, Integer> toCountMap(List<CourseContentCount> rows) {
        Map<UUID, Integer> counts = new HashMap<>();
        for (CourseContentCount row : rows) {
            counts.put(row.getCourseId(), Math.toIntExact(row.getItemCount()));
        }
        return counts;
    }

    private void syncCourseCounters(List<Course> courses,
                                    Map<UUID, Integer> chapterCounts,
                                    Map<UUID, Integer> lessonCounts) {
        for (Course course : courses) {
            syncCourseCounters(
                    course,
                    chapterCounts.getOrDefault(course.getId(), 0),
                    lessonCounts.getOrDefault(course.getId(), 0));
        }
    }

    private void syncCourseCounters(Course course, int chapterCount, int lessonCount) {
        if (!Integer.valueOf(chapterCount).equals(course.getTotalChapters())
                || !Integer.valueOf(lessonCount).equals(course.getTotalLessons())) {
            courseRepository.updateCounts(course.getId(), chapterCount, lessonCount);
        }
    }

    private int countLessons(List<Chapter> chapters) {
        return chapters.stream()
                .mapToInt(ch -> ch.getLessons() != null ? ch.getLessons().size() : 0)
                .sum();
    }

    /**
     * Kiểm tra giá gốc theo quy định UseCase v6.5: 99.000₫ – 1.000.000₫.
     */
    private void validatePrice(int priceVnd) {
        if (priceVnd < 99_000) {
            throw new BusinessException("INVALID_PRICE",
                    "Giá khóa học tối thiểu là 99,000 VND.");
        }
        if (priceVnd > 1_000_000) {
            throw new BusinessException("INVALID_PRICE",
                    "Giá khóa học tối đa là 1,000,000 VND.");
        }
    }

    private void validateSalePrice(Integer salePriceVnd, Integer priceVnd) {
        if (salePriceVnd == null || priceVnd == null) return;
        if (salePriceVnd >= priceVnd) {
            throw new BusinessException("INVALID_SALE_PRICE",
                    "Giá khuyến mãi (" + salePriceVnd + " VND) phải nhỏ hơn giá gốc ("
                    + priceVnd + " VND).");
        }
        if (salePriceVnd < 1000) {
            throw new BusinessException("INVALID_SALE_PRICE",
                    "Giá khuyến mãi tối thiểu 1,000 VND.");
        }
    }

    /**
     * Đếm lại và cập nhật totalChapters + totalLessons cho khóa học.
     *
     * <p>Được gọi sau mỗi thao tác add/delete chapter hoặc lesson để đảm bảo
     * denormalized counter trong bảng courses luôn chính xác.
     * Dùng 2 query đơn giản thay vì trigger DB.
     */
    private void refreshCourseCounts(UUID courseId) {
        int chapterCount = chapterRepository.countByCourseId(courseId);
        int lessonCount = lessonRepository.countByCourseId(courseId);
        courseRepository.updateCounts(courseId, chapterCount, lessonCount);
    }

    private Category loadCategory(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
