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
import com.beeacademy.backend.model.ExamConfig;
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
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
import java.util.stream.Collectors;

/**
 * Nghiá»‡p vá»¥ quáº£n lÃ½ khÃ³a há»c phÃ­a GiÃ¡o viÃªn (Phase 1 â€” CRUD, khÃ´ng upload).
 *
 * <p>Thiáº¿t káº¿: má»—i thao tÃ¡c thÃªm/sá»­a/xÃ³a Chapter vÃ  Lesson sá»­ dá»¥ng
 * {@link ChapterRepository} vÃ  {@link LessonRepository} trá»±c tiáº¿p thay vÃ¬
 * mutate collection cá»§a Course aggregate. LÃ½ do:
 * <ul>
 *   <li>{@code Course.getChapters()} tráº£ unmodifiableList â†’ khÃ´ng thá»ƒ add/remove.</li>
 *   <li>Sá»­ dá»¥ng repository trá»±c tiáº¿p rÃµ rÃ ng hÆ¡n vÃ  trÃ¡nh N+1 khi khÃ´ng cáº§n
 *       load toÃ n bá»™ chapters.</li>
 * </ul>
 *
 * <p>NguyÃªn táº¯c phÃ¢n quyá»n:
 * <ul>
 *   <li>GV chá»‰ thao tÃ¡c Ä‘Æ°á»£c khÃ³a há»c cá»§a chÃ­nh mÃ¬nh (verify teacherId).</li>
 *   <li>Chá»‰ sá»­a ná»™i dung khi status âˆˆ {DRAFT, NEEDS_REVISION}.</li>
 *   <li>Submit: DRAFT/NEEDS_REVISION â†’ PENDING_REVIEW.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeacherCourseService {

    private final CourseRepository          courseRepository;
    private final CategoryRepository        categoryRepository;
    private final ProfileRepository         profileRepository;
    private final QuizConfigRepository      quizConfigRepository;
    private final ChapterRepository         chapterRepository;
    private final LessonRepository          lessonRepository;
    private final CourseDocumentRepository  documentRepository;
    private final QuestionRepository        questionRepository;
    private final EnrollmentRepository      enrollmentRepository;
    private final ApprovalHistoryRepository approvalHistoryRepository;
    private final CourseVersionRepository   courseVersionRepository;
    private final ExamConfigVersionService  examConfigVersionService;
    private final AdminNotificationRepository notificationRepository;
    private final ContentUploadService      contentUploadService;
    private final TeacherAccessService      teacherAccessService;
    private final ObjectMapper              objectMapper;
    private final JdbcTemplate              jdbcTemplate;

    // ========================================================================
    // Course CRUD
    // ========================================================================

    /**
     * Táº¡o khÃ³a há»c má»›i á»Ÿ tráº¡ng thÃ¡i DRAFT.
     * Slug tá»± Ä‘á»™ng sinh tá»« title, Ä‘áº£m báº£o unique báº±ng suffix sá»‘.
     */
    @Transactional
    public TeacherCourseResponse createCourse(AuthenticatedUser me,
                                               CreateCourseRequest req) {
        Profile  teacher  = teacherAccessService.requireApprovedTeacher(me);
        Category category = loadCategory(req.categoryId());

        // Validate: giÃ¡ gá»‘c trong khoáº£ng 99.000â€“1.000.000â‚« (UseCase v6.5)
        validatePrice(req.priceVnd());
        // Validate: giÃ¡ khuyáº¿n mÃ£i pháº£i nhá» hÆ¡n giÃ¡ gá»‘c (cross-field validation)
        validateSalePrice(req.salePriceVnd(), req.priceVnd());
        validateThumbnailUrl(req.thumbnailUrl());
        validateIntroVideoUrl(req.introVideoUrl());

        int[] grades = req.grades().stream().mapToInt(Integer::intValue).toArray();
        Course course = Course.createByTeacher(teacher, req.title(), req.description(),
                                               trimToNull(req.objective()),
                                               trimToNull(req.audience()),
                                               category, grades, req.priceVnd());

        // Äáº£m báº£o slug unique: thÃªm suffix -2, -3... náº¿u Ä‘Ã£ tá»“n táº¡i
        String baseSlug = course.getSlug();
        String slug = baseSlug;
        int suffix = 2;
        while (courseRepository.findBySlug(slug).isPresent()) {
            slug = baseSlug + "-" + suffix++;
        }

        // GÃ¡n salePriceVnd náº¿u cÃ³ (factory khÃ´ng nháº­n field nÃ y).
        // Truyá»n priceVnd=0 vÃ¬ Course.update() cÃ³ guard "if (priceVnd > 0)" â€”
        // 0 sáº½ khÃ´ng ghi Ä‘Ã¨ priceVnd Ä‘Ã£ Ä‘Æ°á»£c set bá»Ÿi factory á»Ÿ trÃªn.
        // KHÃ”NG truyá»n null vÃ¬ priceVnd lÃ  primitive int â€” sáº½ gÃ¢y NullPointerException khi unbox.
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
        log.info("GV {} táº¡o khÃ³a há»c '{}' ({})", me.userId(), saved.getTitle(), saved.getId());
        return TeacherCourseResponse.fromEntity(saved);
    }

    /** Danh sÃ¡ch khÃ³a há»c cá»§a GV, sáº¯p xáº¿p theo updatedAt DESC. */
    @Transactional
    public PageResponse<TeacherCourseResponse> listMyCourses(AuthenticatedUser me,
                                                               Pageable pageable) {
        teacherAccessService.requireApprovedTeacher(me);
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

    /** Chi tiáº¿t khÃ³a há»c + chapters + lessons + lá»‹ch sá»­ duyá»‡t. */
    @Transactional
    public TeacherCourseDetailResponse getCourseDetail(UUID courseId, AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(courseId);
        syncCourseCounters(course, chapters.size(), countLessons(chapters));
        List<ApprovalHistory> history =
                approvalHistoryRepository.findByCourseIdOrderByCreatedAtAsc(courseId);
        List<CourseVersion> versions =
                courseVersionRepository.findByCourseIdOrderByVersionNoDesc(courseId);
        List<Lesson> lessons = chapters.stream()
                .flatMap(chapter -> chapter.getLessons().stream())
                .toList();
        Map<UUID, List<CourseDocument>> documentsByLessonId = loadDocumentsForLessons(lessons)
                .stream()
                .collect(Collectors.groupingBy(document -> document.getLesson().getId()));
        return TeacherCourseDetailResponse.fromEntity(
                course, history, enrollmentRepository.countByCourseId(courseId), chapters, versions,
                documentsByLessonId);
    }

    /** Cáº­p nháº­t thÃ´ng tin cÆ¡ báº£n (chá»‰ khi DRAFT/NEEDS_REVISION). */
    @Transactional
    public TeacherCourseResponse updateCourse(UUID courseId, AuthenticatedUser me,
                                               UpdateCourseRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course   course   = loadAndVerifyOwner(courseId, me.userId());
        assertCourseInfoEditable(course);

        // TÃ­nh giÃ¡ hiá»‡u dá»¥ng sau khi update Ä‘á»ƒ validate cross-field
        Integer effectivePrice     = req.priceVnd()     != null ? req.priceVnd()     : course.getPriceVnd();
        // BUG FIX: null trong request = "giá»¯ nguyÃªn giÃ¡ KM cÅ©", KHÃ”NG pháº£i "xÃ³a giÃ¡ KM".
        // Äá»ƒ xÃ³a giÃ¡ KM, frontend gá»­i clearSalePrice=true hoáº·c salePriceVnd=0.
        Integer effectiveSalePrice = req.salePriceVnd() != null ? req.salePriceVnd() : course.getSalePriceVnd();

        // Validate: giÃ¡ gá»‘c trong khoáº£ng 99.000â€“1.000.000â‚« (UseCase v6.5)
        validatePrice(effectivePrice);
        // Validate: giÃ¡ khuyáº¿n mÃ£i pháº£i nhá» hÆ¡n giÃ¡ gá»‘c (sau khi tÃ­nh giÃ¡ hiá»‡u dá»¥ng)
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

    /**
     * Äá»•i áº£nh bÃ¬a khÃ³a há»c â€” cho phÃ©p á»Ÿ Má»ŒI tráº¡ng thÃ¡i (ká»ƒ cáº£ PUBLISHED).
     *
     * <p>KhÃ¡c {@link #updateCourse}: áº£nh bÃ¬a chá»‰ lÃ  yáº¿u tá»‘ trÃ¬nh bÃ y (cosmetic),
     * khÃ´ng pháº£i ná»™i dung há»c cáº§n duyá»‡t láº¡i â†’ KHÃ”NG gá»i {@code assertCourseInfoEditable}.
     * Upload file má»›i lÃªn Storage rá»“i gÃ¡n URL cÃ´ng khai vÃ o khÃ³a.
     */
    @Transactional
    public TeacherCourseResponse updateThumbnail(UUID courseId, AuthenticatedUser me,
                                                 org.springframework.web.multipart.MultipartFile file) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        var uploaded = contentUploadService.uploadCourseThumbnail(me.userId(), file);
        course.setThumbnailUrl(uploaded.publicUrl());
        Course saved = courseRepository.save(course);
        log.info("GV {} Ä‘á»•i áº£nh bÃ¬a khÃ³a '{}' ({})", me.userId(), saved.getTitle(), saved.getId());
        return TeacherCourseResponse.fromEntity(saved, enrollmentRepository.countByCourseId(saved.getId()));
    }

    /** XÃ³a khÃ³a há»c â€” chá»‰ khi DRAFT. */
    @Transactional
    public void deleteCourse(UUID courseId, AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        if (course.getStatus() != CourseStatus.DRAFT) {
            throw new BusinessException("CANNOT_DELETE",
                    "Chá»‰ cÃ³ thá»ƒ xÃ³a khÃ³a há»c á»Ÿ tráº¡ng thÃ¡i Báº£n nhÃ¡p.");
        }
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(courseId);
        List<Lesson> lessons = chapters.stream()
                .flatMap(chapter -> chapter.getLessons().stream())
                .toList();
        List<CourseDocument> documents = loadDocumentsForLessons(lessons);
        documentRepository.deleteAll(documents);

        // Câu hỏi trong ngân hàng trỏ về chapter_id với FK RESTRICT (không ON DELETE).
        // Phải gỡ liên kết (đưa về cấp môn học) trước khi cascade xóa chapter, nếu không
        // việc xóa khóa học sẽ vỡ vì vi phạm khóa ngoại và toàn bộ giao dịch bị rollback.
        List<UUID> chapterIds = chapters.stream().map(Chapter::getId).toList();
        if (!chapterIds.isEmpty()) {
            questionRepository.detachFromChapters(chapterIds);
        }

        courseRepository.delete(course);
        contentUploadService.deleteLessonFilesAfterCommit(lessons, documents);
        log.info("GV {} xÃ³a khÃ³a há»c {}", me.userId(), courseId);
    }

    /** Ná»™p khÃ³a há»c Ä‘á»ƒ Admin duyá»‡t. */
    @Transactional
    public TeacherCourseResponse submitForReview(UUID courseId, AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());

        // BUG FIX: load chapters má»™t láº§n duy nháº¥t â€” trÆ°á»›c Ä‘Ã¢y query 2 láº§n cÃ¹ng má»™t káº¿t quáº£
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(courseId);

        // Validate: khÃ³a há»c pháº£i cÃ³ Ã­t nháº¥t 1 chÆ°Æ¡ng
        if (chapters.size() < 4) {
            throw new BusinessException("COURSE_MIN_CHAPTERS_REQUIRED",
                    "Khoa hoc phai co toi thieu 4 chuong truoc khi nop duyet.");
        }

        if (chapters.isEmpty()) {
            throw new BusinessException("EMPTY_COURSE",
                    "KhÃ³a há»c pháº£i cÃ³ Ã­t nháº¥t 1 chÆ°Æ¡ng trÆ°á»›c khi ná»™p duyá»‡t.");
        }

        // Validate: má»—i chÆ°Æ¡ng pháº£i cÃ³ Ã­t nháº¥t 1 bÃ i giáº£ng
        boolean anyLessonless = chapters.stream()
                .anyMatch(ch -> ch.getLessons().isEmpty());
        if (anyLessonless) {
            throw new BusinessException("EMPTY_CHAPTER",
                    "Má»—i chÆ°Æ¡ng pháº£i cÃ³ Ã­t nháº¥t 1 bÃ i giáº£ng.");
        }

        chapters.stream()
                .flatMap(chapter -> chapter.getLessons().stream())
                .forEach(lesson -> validateCompletionRuleForLesson(lesson, false));
        List<ExamConfig> submittedExams = examConfigVersionService.ensureDraftSet(courseId);
        validateRequiredExamCoverage(chapters, submittedExams);

        int nextVersion = courseVersionRepository.findMaxVersionNo(courseId) + 1;
        course.markSubmittedVersion(nextVersion);
        course.submitForReview();
        Course saved = courseRepository.save(course);
        CourseVersion version = courseVersionRepository.save(CourseVersion.create(
                saved, saved.getTeacher(), nextVersion,
                buildCourseSnapshotJson(saved, chapters, submittedExams)));
        examConfigVersionService.publishDrafts(courseId, version.getId());
        notificationRepository.save(AdminNotification.courseSubmitted(saved, saved.getTeacher()));
        log.info("GV {} ná»™p khÃ³a há»c {} Ä‘á»ƒ duyá»‡t", me.userId(), courseId);
        return TeacherCourseResponse.fromEntity(saved, enrollmentRepository.countByCourseId(saved.getId()));
    }

    // ========================================================================
    // Chapter CRUD
    // DÃ¹ng ChapterRepository trá»±c tiáº¿p â€” KHÃ”NG mutate Course.chapters (unmodifiable).
    // ========================================================================

    @Transactional
    public TeacherChapterResponse addChapter(UUID courseId, AuthenticatedUser me,
                                              CreateChapterRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // TÃ­nh position tiáº¿p theo náº¿u khÃ´ng truyá»n
        int nextPos = chapterRepository.findByCourseIdOrderByPositionAsc(courseId).size() + 1;
        int position = req.position() != null ? req.position() : nextPos;

        Chapter chapter = Chapter.createNew(course, req.title(), req.description(), position);
        Chapter saved   = chapterRepository.save(chapter);
        refreshCourseCounts(courseId);
        log.info("ThÃªm chÆ°Æ¡ng '{}' vÃ o khÃ³a há»c {}", req.title(), courseId);
        auditContentChange(courseId, "CHAPTER", saved.getId(), "CREATE", "MAJOR",
                me.userId(), null, chapterAuditSnapshot(saved));
        return TeacherChapterResponse.fromEntity(saved);
    }

    @Transactional
    public TeacherChapterResponse updateChapter(UUID courseId, UUID chapterId,
                                                 AuthenticatedUser me,
                                                 UpdateChapterRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        // loadAndVerifyOwner tráº£ Course Ä‘Ã£ load â€” dÃ¹ng láº¡i Ä‘á»ƒ assertEditable,
        // khÃ´ng cáº§n courseRepository.findById() láº§n 2 (trÃ¡nh 1 DB round-trip thá»«a).
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify chapter thuá»™c Ä‘Ãºng courseId (trÃ¡nh chá»‰nh sá»­a chapter cá»§a GV khÃ¡c)
        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Map<String, Object> before = chapterAuditSnapshot(chapter);
        chapter.update(req.title(), req.description(), req.position());
        Chapter saved = chapterRepository.save(chapter);
        auditContentChange(courseId, "CHAPTER", saved.getId(), "UPDATE", "MINOR",
                me.userId(), before, chapterAuditSnapshot(saved));
        return TeacherChapterResponse.fromEntity(saved);
    }

    @Transactional
    public void deleteChapter(UUID courseId, UUID chapterId, AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify chapter thuá»™c courseId trÆ°á»›c khi xÃ³a (trÃ¡nh xÃ³a nháº§m chapter cá»§a ngÆ°á»i khÃ¡c)
        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Map<String, Object> before = chapterAuditSnapshot(chapter);
        List<Lesson> lessons = lessonRepository.findByChapterIdOrderByPositionAsc(chapterId);
        List<CourseDocument> documents = loadDocumentsForLessons(lessons);
        documentRepository.deleteAll(documents);

        // Gỡ liên kết câu hỏi ngân hàng khỏi chương (FK RESTRICT trên questions.chapter_id)
        // trước khi xóa, nếu không việc xóa chương sẽ vỡ vì vi phạm khóa ngoại.
        questionRepository.detachFromChapters(List.of(chapterId));

        // CascadeType.ALL + orphanRemoval trên lessons → xóa lessons theo tự động
        chapterRepository.delete(chapter);
        contentUploadService.deleteLessonFilesAfterCommit(lessons, documents);
        refreshCourseCounts(courseId);
        auditContentChange(courseId, "CHAPTER", chapterId, "DELETE", "MAJOR",
                me.userId(), before, null);
        log.info("XÃ³a chÆ°Æ¡ng {} khá»i khÃ³a há»c {}", chapterId, courseId);
    }

    // ========================================================================
    // Lesson CRUD
    // DÃ¹ng LessonRepository trá»±c tiáº¿p â€” KHÃ”NG mutate Chapter.lessons (unmodifiable).
    // ========================================================================

    @Transactional
    public TeacherLessonResponse addLesson(UUID courseId, UUID chapterId,
                                            AuthenticatedUser me,
                                            CreateLessonRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        Chapter chapter = chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        int nextPos = lessonRepository.countByChapterId(chapterId) + 1;
        int position = req.position() != null ? req.position() : nextPos;

        Lesson lesson = Lesson.createNew(chapter, req.title(), req.description(),
                                         position, req.isFree());
        lesson.updateLearningMetadata(req.completionRule(), req.transcript(), req.subtitleUrl(),
                normalizeSlideCueSeconds(req.slideCueSeconds()), trimToNull(req.videoFallbackUrl()));
        if (req.videoEmbedUrl() != null && !req.videoEmbedUrl().isBlank()) {
            lesson.setVideoEmbedUrl(req.videoEmbedUrl());
        }

        validateCompletionRuleForLesson(lesson, "upload".equals(normalizeVideoSource(req.videoSource())));
        Lesson saved = lessonRepository.save(lesson);
        refreshCourseCounts(courseId);
        auditContentChange(courseId, "LESSON", saved.getId(), "CREATE", "MAJOR",
                me.userId(), null, lessonSnapshot(saved));
        log.info("ThÃªm bÃ i giáº£ng '{}' vÃ o chÆ°Æ¡ng {}", req.title(), chapterId);
        return TeacherLessonResponse.fromEntity(saved);
    }

    @Transactional
    public TeacherLessonResponse updateLesson(UUID courseId, UUID chapterId,
                                               UUID lessonId, AuthenticatedUser me,
                                               UpdateLessonRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        // Verify ownership chain: lesson â†’ chapter â†’ course â†’ teacher
        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        String oldVideoPath = lesson.getVideoStoragePath();
        String videoSource = normalizeVideoSource(req.videoSource());
        Map<String, Object> before = lessonSnapshot(lesson);

        lesson.update(
                req.title(),
                req.description(),
                req.position(),
                req.isFree() != null ? req.isFree() : lesson.getIsFree());
        lesson.updateLearningMetadata(req.completionRule(), req.transcript(), req.subtitleUrl(),
                normalizeSlideCueSeconds(req.slideCueSeconds()), trimToNull(req.videoFallbackUrl()));

        if ("embed".equals(videoSource)) {
            String embedUrl = trimToNull(req.videoEmbedUrl());
            if (embedUrl == null) {
                throw new BusinessException("INVALID_VIDEO_SOURCE",
                        "Vui lÃ²ng nháº­p URL YouTube/Vimeo khi chá»n video nhÃºng.");
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

        validateCompletionRuleForLesson(lesson, "upload".equals(videoSource));
        Lesson saved = lessonRepository.save(lesson);
        auditContentChange(courseId, "LESSON", saved.getId(), "UPDATE", detectLessonChangeType(before, saved),
                me.userId(), before, lessonSnapshot(saved));
        return TeacherLessonResponse.fromEntity(saved);
    }

    @Transactional
    public void deleteLesson(UUID courseId, UUID chapterId, UUID lessonId,
                              AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        Lesson lesson = lessonRepository.findByIdAndChapterId(lessonId, chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));

        Map<String, Object> before = lessonSnapshot(lesson);
        List<CourseDocument> documents = documentRepository.findByLessonIdOrderByPositionAsc(lessonId);
        documentRepository.deleteAll(documents);
        lessonRepository.delete(lesson);
        contentUploadService.deleteLessonFilesAfterCommit(List.of(lesson), documents);
        refreshCourseCounts(courseId);
        auditContentChange(courseId, "LESSON", lessonId, "DELETE", "MAJOR",
                me.userId(), before, null);
        log.info("XÃ³a bÃ i giáº£ng {} khá»i chÆ°Æ¡ng {}", lessonId, chapterId);
    }

    @Transactional
    public TeacherCourseDetailResponse reorderChapters(UUID courseId, AuthenticatedUser me,
                                                       ReorderChaptersRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        Map<String, Object> before = orderedChapterAuditSnapshot(chapters);
        validateReorderIds(
                chapters.stream().map(Chapter::getId).collect(java.util.stream.Collectors.toSet()),
                req.chapters().stream().map(ReorderItemRequest::id).toList(),
                "Danh sÃ¡ch chÆ°Æ¡ng khÃ´ng khá»›p vá»›i khÃ³a há»c hiá»‡n táº¡i.");

        Map<UUID, Chapter> byId = chapters.stream()
                .collect(java.util.stream.Collectors.toMap(Chapter::getId, ch -> ch));
        List<ReorderItemRequest> ordered = req.chapters().stream()
                .sorted(Comparator.comparing(ReorderItemRequest::position))
                .toList();

        for (int i = 0; i < ordered.size(); i++) {
            byId.get(ordered.get(i).id()).update(null, null, i + 1);
        }
        chapterRepository.saveAll(chapters);
        auditContentChange(courseId, "CHAPTER", courseId, "REORDER", "MAJOR",
                me.userId(), before, orderedChapterAuditSnapshot(chapters));
        return getCourseDetail(courseId, me);
    }

    @Transactional
    public TeacherCourseDetailResponse reorderLessons(UUID courseId, UUID chapterId,
                                                      AuthenticatedUser me,
                                                      ReorderLessonsRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        Course course = loadAndVerifyOwner(courseId, me.userId());
        assertEditable(course);

        chapterRepository.findByIdAndCourseId(chapterId, courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));

        List<Lesson> lessons = lessonRepository.findByChapterIdOrderByPositionAsc(chapterId);
        Map<String, Object> before = orderedLessonAuditSnapshot(chapterId, lessons);
        validateReorderIds(
                lessons.stream().map(Lesson::getId).collect(java.util.stream.Collectors.toSet()),
                req.lessons().stream().map(ReorderItemRequest::id).toList(),
                "Danh sÃ¡ch bÃ i giáº£ng khÃ´ng khá»›p vá»›i chÆ°Æ¡ng hiá»‡n táº¡i.");

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
        auditContentChange(courseId, "LESSON", chapterId, "REORDER", "MAJOR",
                me.userId(), before, orderedLessonAuditSnapshot(chapterId, lessons));
        return getCourseDetail(courseId, me);
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

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
                "Nguá»“n video khÃ´ng há»£p lá»‡. Chá»‰ cháº¥p nháº­n upload, embed hoáº·c none.");
    }

    private void validateCompletionRuleForLesson(Lesson lesson, boolean allowPendingVideo) {
        boolean hasVideo = lesson.getVideoStoragePath() != null
                || lesson.getVideoUrl() != null
                || lesson.getVideoEmbedUrl() != null;
        if (hasVideo || allowPendingVideo) return;
        String rule = lesson.getCompletionRule();
        if (rule == null || !Set.of("DOCUMENT_OPENED", "MARK_AS_COMPLETE",
                "ASSIGNMENT_SUBMITTED", "ASSIGNMENT_PASSED").contains(rule)) {
            throw new BusinessException("COMPLETION_RULE_REQUIRED",
                    "Bai hoc khong co video phai chon completion_rule hop le.");
        }
    }

    private String detectLessonChangeType(Map<String, Object> before, Lesson after) {
        if (before == null) return "MAJOR";
        boolean videoChanged = !java.util.Objects.equals(before.get("videoEmbedUrl"), after.getVideoEmbedUrl())
                || !java.util.Objects.equals(before.get("videoStoragePath"), after.getVideoStoragePath())
                || !java.util.Objects.equals(before.get("completionRule"), after.getCompletionRule());
        return videoChanged ? "MAJOR" : "MINOR";
    }

    private Map<String, Object> chapterAuditSnapshot(Chapter chapter) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", chapter.getId());
        row.put("title", chapter.getTitle());
        row.put("description", chapter.getDescription());
        row.put("position", chapter.getPosition());
        return row;
    }

    private Map<String, Object> orderedChapterAuditSnapshot(List<Chapter> chapters) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("chapters", chapters.stream()
                .sorted(Comparator.comparing(Chapter::getPosition))
                .map(this::chapterAuditSnapshot)
                .toList());
        return row;
    }

    private Map<String, Object> orderedLessonAuditSnapshot(UUID chapterId, List<Lesson> lessons) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("chapterId", chapterId);
        row.put("lessons", lessons.stream()
                .sorted(Comparator.comparing(Lesson::getPosition))
                .map(this::lessonSnapshot)
                .toList());
        return row;
    }

    private void auditContentChange(UUID courseId, String entityType, UUID entityId, String action,
                                    String changeType, UUID actorId,
                                    Map<String, Object> before, Map<String, Object> after) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO public.course_content_audit_logs
                    (course_id, entity_type, entity_id, action, change_type, actor_id, before_state, after_state)
                    VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
                    """,
                    courseId, entityType, entityId, action, changeType, actorId,
                    toJsonOrNull(before), toJsonOrNull(after));
        } catch (Exception ex) {
            log.warn("Could not write course content audit log course={} entity={} action={}",
                    courseId, entityType, action, ex);
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
                    "áº¢nh bÃ¬a khÃ³a há»c pháº£i lÃ  áº£nh, khÃ´ng dÃ¹ng URL video giá»›i thiá»‡u.");
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
                        "URL video giá»›i thiá»‡u pháº£i báº¯t Ä‘áº§u báº±ng http:// hoáº·c https://.");
            }
            if (host == null || host.isBlank()) {
                throw new BusinessException("INVALID_INTRO_VIDEO",
                        "URL video giá»›i thiá»‡u khÃ´ng há»£p lá»‡.");
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
                        "Video giá»›i thiá»‡u chá»‰ há»— trá»£ YouTube, Vimeo hoáº·c file MP4/WebM/MOV cÃ´ng khai.");
            }
        } catch (URISyntaxException e) {
            throw new BusinessException("INVALID_INTRO_VIDEO",
                    "URL video giá»›i thiá»‡u khÃ´ng há»£p lá»‡.");
        }
    }

    private String buildCourseSnapshotJson(
            Course course, List<Chapter> chapters, List<ExamConfig> submittedExams) {
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
        snapshot.put("quizChapterIds", quizConfigRepository.findByCourseIds(List.of(course.getId()))
                .stream()
                .map(config -> config.getChapter().getId())
                .distinct()
                .toList());
        snapshot.put("chapters", chapters.stream()
                .sorted(Comparator.comparing(Chapter::getPosition))
                .map(this::chapterSnapshot)
                .toList());
        snapshot.put("requiredExams", submittedExams.stream()
                .sorted(Comparator.comparing(ExamConfig::getSlotIndex))
                .map(this::examSnapshot)
                .toList());
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new BusinessException("SNAPSHOT_FAILED",
                    "KhÃ´ng thá»ƒ táº¡o phiÃªn báº£n khÃ³a há»c Ä‘á»ƒ ná»™p duyá»‡t.");
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
        row.put("videoFallbackUrl", lesson.getVideoFallbackUrl());
        row.put("hlsPlaylistUrl", lesson.getHlsPlaylistUrl());
        row.put("videoProcessingStatus", lesson.getVideoProcessingStatus());
        row.put("originalVideoRetentionUntil", lesson.getOriginalVideoRetentionUntil());
        row.put("completionRule", lesson.getCompletionRule());
        row.put("slideCueSeconds", lesson.getSlideCueSeconds());
        return row;
    }

    private Map<String, Object> examSnapshot(ExamConfig exam) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", exam.getId());
        row.put("slotIndex", exam.getSlotIndex());
        row.put("examType", exam.getExamType());
        row.put("name", exam.getName());
        row.put("scopeStartChapterId", exam.getScopeStartChapter() != null
                ? exam.getScopeStartChapter().getId() : null);
        row.put("placementChapterId", exam.getPlacementChapter() != null
                ? exam.getPlacementChapter().getId() : null);
        row.put("durationMinutes", exam.getDurationMinutes());
        row.put("passScorePercent", exam.getPassScorePercent());
        return row;
    }

    private void validateRequiredExamCoverage(
            List<Chapter> chapters, List<ExamConfig> exams) {
        if (exams.size() != 4 || exams.stream().map(ExamConfig::getSlotIndex).collect(Collectors.toSet()).size() != 4) {
            throw new BusinessException("REQUIRED_EXAMS_MISSING",
                    "Khoa hoc phai co dung 4 bai kiem tra bat buoc.");
        }
        Map<Integer, ExamConfig> bySlot = exams.stream()
                .collect(Collectors.toMap(ExamConfig::getSlotIndex, exam -> exam));
        for (int slot = 0; slot < 4; slot++) {
            if (!bySlot.containsKey(slot)) {
                throw new BusinessException("REQUIRED_EXAMS_MISSING",
                        "Thieu bai kiem tra bat buoc o slot " + (slot + 1) + ".");
            }
        }

        List<Chapter> ordered = chapters.stream()
                .sorted(Comparator.comparing(Chapter::getPosition))
                .toList();
        int coveredUntil = -1;
        for (int slot = 0; slot < 4; slot++) {
            ExamConfig exam = bySlot.get(slot);
            int start = indexOfChapter(ordered, exam.getScopeStartChapter() != null
                    ? exam.getScopeStartChapter().getId() : null);
            int end = indexOfChapter(ordered, exam.getPlacementChapter() != null
                    ? exam.getPlacementChapter().getId() : null);
            if (start < 0 || end < start) {
                throw new BusinessException("INVALID_EXAM_SCOPE_COVERAGE",
                        "Pham vi bai kiem tra khong hop le.");
            }
            if (start > coveredUntil + 1) {
                throw new BusinessException("INVALID_EXAM_SCOPE_COVERAGE",
                        "Pham vi 4 bai kiem tra khong duoc bo trong chuong.");
            }
            coveredUntil = Math.max(coveredUntil, end);
        }
        if (coveredUntil != ordered.size() - 1) {
            throw new BusinessException("INVALID_EXAM_SCOPE_COVERAGE",
                    "Pham vi 4 bai kiem tra phai phu tu chuong dau den chuong cuoi.");
        }
    }

    private int indexOfChapter(List<Chapter> chapters, UUID chapterId) {
        if (chapterId == null) return -1;
        for (int i = 0; i < chapters.size(); i++) {
            if (chapters.get(i).getId().equals(chapterId)) {
                return i;
            }
        }
        return -1;
    }

    private String normalizeSlideCueSeconds(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) return null;
        String[] parts = normalized.split(",");
        int previous = -1;
        StringBuilder result = new StringBuilder();
        for (String part : parts) {
            int second;
            try {
                second = Integer.parseInt(part.trim());
            } catch (NumberFormatException ex) {
                throw new BusinessException("INVALID_SLIDE_CUES",
                        "Moc dong bo slide phai la cac so giay, cach nhau bang dau phay.", HttpStatus.BAD_REQUEST);
            }
            if (second < 0 || second <= previous) {
                throw new BusinessException("INVALID_SLIDE_CUES",
                        "Moc dong bo slide phai tang dan va khong am.", HttpStatus.BAD_REQUEST);
            }
            if (result.length() > 0) result.append(',');
            result.append(second);
            previous = second;
        }
        return result.toString();
    }

    /**
     * Load course vÃ  verify GV lÃ  owner.
     * NÃ©m 404 náº¿u khÃ´ng tá»“n táº¡i, 403 náº¿u khÃ´ng pháº£i owner.
     */
    private Course loadAndVerifyOwner(UUID courseId, UUID teacherId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (!course.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Báº¡n khÃ´ng cÃ³ quyá»n chá»‰nh sá»­a khÃ³a há»c nÃ y.", HttpStatus.FORBIDDEN);
        }
        return course;
    }

    /**
     * Chá»‰ cho phÃ©p edit khi status âˆˆ {DRAFT, NEEDS_REVISION, REJECTED}.
     *
     * <p>CÃ¡c tráº¡ng thÃ¡i cho phÃ©p sá»­a:
     * <ul>
     *   <li>DRAFT â€” khÃ³a há»c má»›i táº¡o, chÆ°a ná»™p.</li>
     *   <li>NEEDS_REVISION â€” Admin yÃªu cáº§u chá»‰nh sá»­a rá»“i ná»™p láº¡i.</li>
     *   <li>REJECTED â€” Admin tá»« chá»‘i; GV cáº§n chá»‰nh sá»­a rá»“i ná»™p láº¡i qua draft má»›i.</li>
     * </ul>
     *
     * <p>CÃ¡c tráº¡ng thÃ¡i Bá»Š CHáº¶N:
     * <ul>
     *   <li>PENDING_REVIEW â€” Ä‘ang chá» Admin duyá»‡t, khÃ´ng Ä‘Æ°á»£c sá»­a.</li>
     *   <li>APPROVED â€” Admin Ä‘Ã£ duyá»‡t, chá» publish.</li>
     *   <li>PUBLISHED â€” Ä‘ang hiá»ƒn thá»‹ cho há»c sinh, khÃ´ng sá»­a khÃ´ng qua duyá»‡t.</li>
     *   <li>ARCHIVED â€” Ä‘Ã£ lÆ°u trá»¯.</li>
     * </ul>
     */
    private void assertEditable(Course course) {
        CourseStatus s = course.getStatus();
        // Whitelist approach: chá»‰ cho phÃ©p khi status thuá»™c danh sÃ¡ch an toÃ n
        boolean editable = s == CourseStatus.DRAFT
                        || s == CourseStatus.NEEDS_REVISION
                        || s == CourseStatus.REJECTED;  // GV cáº§n sá»­a sau khi bá»‹ tá»« chá»‘i
        if (!editable) {
            String statusLabel = switch (s) {
                case PENDING_REVIEW -> "Äang chá» duyá»‡t";
                case APPROVED       -> "ÄÃ£ duyá»‡t (chá» publish)";
                case PUBLISHED      -> "ÄÃ£ phÃ¡t hÃ nh";
                case ARCHIVED       -> "ÄÃ£ lÆ°u trá»¯";
                default             -> s.toDbValue();
            };
            throw new BusinessException("NOT_EDITABLE",
                    "KhÃ´ng thá»ƒ chá»‰nh sá»­a khi khÃ³a há»c Ä‘ang á»Ÿ tráº¡ng thÃ¡i '"
                    + statusLabel + "'.");
        }
    }

    /**
     * Chá»‰ cho phÃ©p cáº­p nháº­t thÃ´ng tin cÆ¡ báº£n khi status âˆˆ {DRAFT, NEEDS_REVISION, REJECTED}.
     *
     * <p>PENDING_REVIEW vÃ  PUBLISHED bá»‹ cháº·n Ä‘á»ƒ Ä‘áº£m báº£o má»i thay Ä‘á»•i thÃ´ng tin
     * (tiÃªu Ä‘á», giÃ¡, mÃ´ táº£) Ä‘á»u pháº£i qua workflow duyá»‡t cá»§a Admin (UC36).
     * Náº¿u GV muá»‘n chá»‰nh sá»­a khÃ³a Ä‘ang duyá»‡t/Ä‘Ã£ phÃ¡t hÃ nh, pháº£i Ä‘áº·t vá» DRAFT trÆ°á»›c.
     */
    private void assertCourseInfoEditable(Course course) {
        CourseStatus s = course.getStatus();
        boolean editable = s == CourseStatus.DRAFT
                        || s == CourseStatus.NEEDS_REVISION
                        || s == CourseStatus.REJECTED;
        if (!editable) {
            String statusLabel = switch (s) {
                case PENDING_REVIEW -> "Äang chá» duyá»‡t";
                case APPROVED       -> "ÄÃ£ duyá»‡t (chá» publish)";
                case PUBLISHED      -> "ÄÃ£ phÃ¡t hÃ nh";
                case ARCHIVED       -> "ÄÃ£ lÆ°u trá»¯";
                default             -> s.toDbValue();
            };
            throw new BusinessException("NOT_EDITABLE",
                    "KhÃ´ng thá»ƒ cáº­p nháº­t thÃ´ng tin khi khÃ³a há»c Ä‘ang á»Ÿ tráº¡ng thÃ¡i '"
                    + statusLabel + "'. LiÃªn há»‡ Admin Ä‘á»ƒ há»— trá»£.");
        }
    }

    /**
     * Validate giÃ¡ khuyáº¿n mÃ£i pháº£i nhá» hÆ¡n giÃ¡ gá»‘c.
     * Bá» qua náº¿u salePriceVnd = null (khÃ´ng Ã¡p dá»¥ng KM).
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
     * Kiá»ƒm tra giÃ¡ gá»‘c theo quy Ä‘á»‹nh UseCase v6.5: 99.000â‚« â€“ 1.000.000â‚«.
     */
    private void validatePrice(int priceVnd) {
        if (priceVnd < 99_000) {
            throw new BusinessException("INVALID_PRICE",
                    "GiÃ¡ khÃ³a há»c tá»‘i thiá»ƒu lÃ  99,000 VND.");
        }
        if (priceVnd > 1_000_000) {
            throw new BusinessException("INVALID_PRICE",
                    "GiÃ¡ khÃ³a há»c tá»‘i Ä‘a lÃ  1,000,000 VND.");
        }
    }

    private void validateSalePrice(Integer salePriceVnd, Integer priceVnd) {
        if (salePriceVnd == null || priceVnd == null) return;
        if (salePriceVnd >= priceVnd) {
            throw new BusinessException("INVALID_SALE_PRICE",
                    "GiÃ¡ khuyáº¿n mÃ£i (" + salePriceVnd + " VND) pháº£i nhá» hÆ¡n giÃ¡ gá»‘c ("
                    + priceVnd + " VND).");
        }
        if (salePriceVnd < 1000) {
            throw new BusinessException("INVALID_SALE_PRICE",
                    "GiÃ¡ khuyáº¿n mÃ£i tá»‘i thiá»ƒu 1,000 VND.");
        }
    }

    /**
     * Äáº¿m láº¡i vÃ  cáº­p nháº­t totalChapters + totalLessons cho khÃ³a há»c.
     *
     * <p>ÄÆ°á»£c gá»i sau má»—i thao tÃ¡c add/delete chapter hoáº·c lesson Ä‘á»ƒ Ä‘áº£m báº£o
     * denormalized counter trong báº£ng courses luÃ´n chÃ­nh xÃ¡c.
     * DÃ¹ng 2 query Ä‘Æ¡n giáº£n thay vÃ¬ trigger DB.
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

