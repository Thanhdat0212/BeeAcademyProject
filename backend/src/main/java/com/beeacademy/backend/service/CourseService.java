package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.CategoryResponse;
import com.beeacademy.backend.dto.response.CourseDetailResponse;
import com.beeacademy.backend.dto.response.CourseSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.CourseReviewModerationStatus;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.CourseContentCount;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseReviewRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.repository.spec.CourseSpecifications;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nghiệp vụ duyệt khoá học công khai (UC06-UC08).
 *
 * <p>Service KHÔNG biết user là ai (qua param {@link AuthenticatedUser},
 * có thể null = guest). Logic phân quyền chỉ ảnh hưởng việc lộ video URL,
 * không ảnh hưởng việc trả về danh sách (mọi user đều thấy cùng list).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseService {

    private static final String VIDEO_BUCKET = "course-videos";
    private final CourseRepository         courseRepository;
    private final CategoryRepository       categoryRepository;
    private final EnrollmentRepository     enrollmentRepository;
    private final LessonRepository         lessonRepository;
    private final CourseDocumentRepository documentRepository;
    private final CourseReviewRepository   courseReviewRepository;
    private final QuizConfigRepository     quizConfigRepository;
    private final SupabaseStorageClient    storageClient;
    private final CourseProgressService    courseProgressService;
    private final CertificateEligibilityService certificateEligibilityService;
    private final CourseProgressItemRepository courseProgressItemRepository;
    private final StudentVideoProgressRepository studentVideoProgressRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final JdbcTemplate             jdbcTemplate;

    // ========================================================================
    // UC06 - Tìm kiếm & lọc khoá học
    // ========================================================================

    /**
     * Trả về danh sách khoá học đã PUBLISHED, áp filter động.
     *
     * <p>Compose specifications:
     * <ol>
     *   <li>{@code onlyPublished()} - mặc định luôn áp.</li>
     *   <li>{@code matchCategorySlug(subject)} - bỏ qua nếu null.</li>
     *   <li>{@code matchGrade(grade)} - bỏ qua nếu null.</li>
     *   <li>{@code matchKeyword(q)} - bỏ qua nếu rỗng.</li>
     * </ol>
     *
     * @param subjectSlug   slug danh mục (toan-hoc, ngu-van, …), nullable
     * @param grade         số lớp (6-9), nullable
     * @param keyword       từ khoá tìm kiếm trong thông tin công khai, nullable
     * @param minPrice      giá thực tế tối thiểu, nullable
     * @param maxPrice      giá thực tế tối đa, nullable
     * @param minRating     điểm đánh giá trung bình tối thiểu, nullable
     * @param pageable      paging + sort do controller pass xuống
     * @return PageResponse chứa CourseSummaryResponse
     */
    @Transactional(readOnly = true)
    public PageResponse<CourseSummaryResponse> searchCourses(String subjectSlug,
                                                              Integer grade,
                                                              String keyword,
                                                              Boolean featured,
                                                              Integer minPrice,
                                                              Integer maxPrice,
                                                              Double minRating,
                                                              Pageable pageable) {
        String requestedSort = requestedSort(pageable);
        boolean relevanceSort = StringUtils.hasText(keyword)
                && ("relevance".equals(requestedSort) || "createdAt".equals(requestedSort));
        // Build spec composable. Specification.where() có thể nhận null spec -
        // trả về spec "always true" → khởi đầu sạch.
        Specification<Course> spec = Specification.where(CourseSpecifications.onlyPublished())
                .and(CourseSpecifications.matchCategorySlug(subjectSlug))
                .and(CourseSpecifications.matchGrade(grade))
                .and(CourseSpecifications.matchKeyword(keyword))
                .and(CourseSpecifications.matchEffectivePrice(minPrice, maxPrice))
                .and(CourseSpecifications.matchMinimumRating(minRating))
                .and(relevanceSort ? CourseSpecifications.orderByKeywordRelevance(keyword) : null)
                .and(relevanceSort ? null : CourseSpecifications.orderBySort(requestedSort))
                .and(CourseSpecifications.onlyFeatured(featured));

        Pageable effectivePageable = normalizeSearchPageable(pageable, requestedSort, relevanceSort);
        Page<Course> coursePage = courseRepository.findAll(spec, effectivePageable);
        log.debug("Search courses: subject={}, grade={}, q={}, minPrice={}, maxPrice={}, minRating={}, sort={}, found={}",
                subjectSlug, grade, keyword, minPrice, maxPrice, minRating,
                requestedSort, coursePage.getTotalElements());

        Set<UUID> previewCourseIds = findCoursesWithFreePreview(coursePage.getContent());
        Map<UUID, CourseReviewService.RatingSummary> ratingByCourseId = summarizeRatings(coursePage.getContent());
        // studentCount: feature riêng của local (team3 đã bỏ) — đếm enrollments 1 lần/batch.
        Map<UUID, Integer> studentCounts = buildStudentCounts(coursePage.getContent());

        // Map qua DTO. findAll(spec) đã override với @EntityGraph(category, teacher)
        // trong CourseRepository — không còn N+1 khi DTO đọc tên category/teacher.
        return PageResponse.of(coursePage,
                course -> {
                    CourseReviewService.RatingSummary rating = ratingByCourseId.getOrDefault(
                            course.getId(),
                            new CourseReviewService.RatingSummary(0.0, 0)
                    );
                    return CourseSummaryResponse.fromEntity(
                            course,
                            previewCourseIds.contains(course.getId()),
                            rating.averageRating(),
                            rating.reviewCount(),
                            studentCounts.getOrDefault(course.getId(), 0)
                    );
                });
    }

    private String requestedSort(Pageable pageable) {
        if (pageable == null || pageable.getSort().isUnsorted()) return "newest";
        return pageable.getSort().iterator().next().getProperty();
    }

    /** Map các nhãn sort của UC06 sang field read-only/cột thật trong DB. */
    private Pageable normalizeSearchPageable(Pageable pageable,
                                              String requestedSort,
                                              boolean relevanceSort) {
        int page = pageable == null ? 0 : pageable.getPageNumber();
        int size = pageable == null ? 20 : pageable.getPageSize();
        // CriteriaSpecification đã đặt ORDER BY; không để Pageable sinh
        // ORDER BY được tạo trực tiếp trong CriteriaSpecification.
        return PageRequest.of(page, size, Sort.unsorted());
    }

    // ========================================================================
    // UC07 - Chi tiết khoá học
    // ========================================================================

    /**
     * Lấy chi tiết khoá học theo UUID.
     *
     * <p>{@code @Transactional} bắt buộc vì sau khi load Course (LAZY
     * chapters), code map DTO sẽ trigger fetch chapters + lessons - cần
     * persistence context vẫn mở.
     *
     * @param id    UUID khoá
     * @param me    user hiện tại (null = guest) - quyết định có thấy video không
     */
    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetail(UUID id, AuthenticatedUser me) {
        Course course = courseRepository.findWithCategoryAndTeacherById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course", id));
        ensureCanViewCourseDetail(course, me);

        boolean canSeeAllVideos = canUserAccessAllVideos(course, me);
        CourseDetailResponse response = CourseDetailResponse.fromEntity(course, canSeeAllVideos,
                buildUrlResolver(canSeeAllVideos), buildDocMap(course),
                buildChaptersWithQuiz(course));
        Object[] rawRating = courseReviewRepository.summarizeByCourseId(
                course.getId(), CourseReviewModerationStatus.PUBLISHED);
        return response
                .withRating(extractAverageRating(rawRating), extractReviewCount(rawRating))
                .withStudentCount(enrollmentRepository.countByCourseId(course.getId()));
    }

    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetailBySlug(String slug, AuthenticatedUser me) {
        Course course = courseRepository.findWithCategoryAndTeacherBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Course", slug));
        ensureCanViewCourseDetail(course, me);

        boolean canSeeAllVideos = canUserAccessAllVideos(course, me);
        CourseDetailResponse response = CourseDetailResponse.fromEntity(course, canSeeAllVideos,
                buildUrlResolver(canSeeAllVideos), buildDocMap(course),
                buildChaptersWithQuiz(course));
        Object[] rawRating = courseReviewRepository.summarizeByCourseId(
                course.getId(), CourseReviewModerationStatus.PUBLISHED);
        return response
                .withRating(extractAverageRating(rawRating), extractReviewCount(rawRating))
                .withStudentCount(enrollmentRepository.countByCourseId(course.getId()));
    }

    /**
     * Trả về tập chapterId đã có quiz config trong khóa học.
     *
     * <p>1 query duy nhất cho tất cả chapters — tránh N+1 nếu dùng
     * {@code existsByChapterId} cho từng chapter.
     */
    private Set<UUID> buildChaptersWithQuiz(Course course) {
        List<UUID> chapterIds = course.getChapters().stream()
                .map(ch -> ch.getId())
                .toList();
        if (chapterIds.isEmpty()) return Collections.emptySet();
        return quizConfigRepository.findConfiguredChapterIds(chapterIds);
    }

    /**
     * Fetch tất cả tài liệu đính kèm của khoá học, group theo lessonId.
     * Dùng để trả về documents trong LessonResponse.
     */
    private java.util.Map<java.util.UUID, java.util.List<CourseDocument>> buildDocMap(Course course) {
        // Lấy tất cả lessonId trong khoá
        java.util.List<java.util.UUID> lessonIds = course.getChapters().stream()
                .flatMap(ch -> ch.getLessons().stream())
                .map(Lesson::getId)
                .toList();

        if (lessonIds.isEmpty()) return java.util.Collections.emptyMap();

        // Fetch documents theo batch và group theo lessonId
        return documentRepository.findByLessonIdIn(lessonIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(d -> d.getLesson().getId()));
    }

    /** Resolver: nếu lesson có videoStoragePath và user có quyền → generate signed URL. */
    private java.util.function.Function<Lesson, String> buildUrlResolver(boolean canSeeAll) {
        return lesson -> {
            if (!canSeeAll && !Boolean.TRUE.equals(lesson.getIsFree())) {
                return null;
            }
            if (lesson.getVideoStoragePath() != null) {
                try {
                    return storageClient.generateSignedUrl(VIDEO_BUCKET,
                            lesson.getVideoStoragePath(), 3600);
                } catch (Exception e) {
                    log.warn("Không tạo được signed URL cho lesson {}: {}",
                            lesson.getId(), e.getMessage());
                    return null;
                }
            }
            return lesson.getVideoUrl();
        };
    }

    // ========================================================================
    // UC08 - Logic phân quyền xem video (xem thử / xem đầy đủ)
    // ========================================================================

    /**
     * Quyết định user có được xem TOÀN BỘ video không (UC08).
     *
     * <p><b>Luồng quyết định (theo thứ tự ưu tiên):</b>
     * <ol>
     *   <li><b>Guest</b> ({@code me == null}) → KHÔNG. Chỉ thấy lesson {@code isFree=true}.</li>
     *   <li><b>Admin</b> → CÓ. Cần xem khoá học để duyệt nội dung.</li>
     *   <li><b>Teacher sở hữu khoá</b> → CÓ. GV cần xem lại bài của mình.</li>
     *   <li><b>Student đã mua</b> → CÓ. Kiểm tra bảng {@code enrollments}.</li>
     *   <li>Còn lại (student chưa mua, parent, teacher khoá khác) → KHÔNG.</li>
     * </ol>
     *
     * <p>Khi trả về KHÔNG, {@link LessonResponse#fromEntity} sẽ set
     * {@code videoUrl = null} cho các lesson {@code isFree=false} —
     * frontend hiển thị màn hình marketing thay vì player.
     */
    private boolean canUserAccessAllVideos(Course course, AuthenticatedUser me) {
        // Bước 1: Guest không xem được
        if (me == null) return false;

        // Bước 2: Admin xem tất cả khoá học (để duyệt nội dung)
        if ("admin".equalsIgnoreCase(me.role())) return true;

        // Bước 3: Chính giáo viên tạo ra khoá được xem toàn bộ
        if (course.getTeacher() != null && course.getTeacher().getId().equals(me.userId())) {
            return true;
        }

        // Bước 4: Student đã mua khoá này — kiểm tra bảng enrollments
        // Dùng existsBy thay vì findBy để tránh load toàn bộ entity
        return enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), course.getId());
    }

    /**
     * UC08: chỉ ghi nhận khi bài học thực sự thuộc khóa PUBLISHED và được đánh
     * dấu isFree. Không tin dữ liệu do frontend gửi lên.
     */
    @Transactional
    public void recordPreviewView(UUID courseId, UUID lessonId, AuthenticatedUser me) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        ensureCanViewCourseDetail(course, me);

        Lesson lesson = lessonRepository.findWithChapterAndCourseById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));
        if (!lesson.getChapter().getCourse().getId().equals(courseId)
                || !Boolean.TRUE.equals(lesson.getIsFree())) {
            throw new ResourceNotFoundException("Lesson", lessonId);
        }

        jdbcTemplate.update("""
                INSERT INTO public.course_preview_views (id, course_id, lesson_id, viewed_at)
                VALUES (?, ?, ?, NOW())
                """, UUID.randomUUID(), courseId, lessonId);
    }

    /**
     * UC07: chỉ khóa PUBLISHED mới công khai. Khóa chưa xuất bản chỉ giáo viên
     * sở hữu và Admin được xem; mọi trường hợp khác nhận 404 như SRS quy định.
     */
    private void ensureCanViewCourseDetail(Course course, AuthenticatedUser me) {
        if (course.getStatus().isPubliclyVisible()) return;
        if (me != null && "admin".equalsIgnoreCase(me.role())) return;
        if (me != null && course.getTeacher() != null
                && course.getTeacher().getId().equals(me.userId())) return;
        throw new ResourceNotFoundException("Course", course.getId());
    }

    // ========================================================================
    // UC — Danh sách khoá học của tôi (đã enroll)
    // ========================================================================

    /**
     * Trả về tất cả khoá học mà student đã enroll, sắp xếp mới nhất lên trước.
     *
     * <p>Dùng cho {@code GET /api/me/courses}. Chỉ có student/teacher/admin
     * mới gọi được (JWT required). Guest → trả list rỗng.
     *
     * @param me user hiện tại từ JWT
     */
    @Transactional(readOnly = true)
    public List<CourseSummaryResponse> getMyCourses(AuthenticatedUser me) {
        if (me == null) return Collections.emptyList();
        List<Enrollment> rawEnrollments = enrollmentRepository
                .findByStudentIdOrderByEnrolledAtDesc(me.userId());
        Map<UUID, Enrollment> enrollmentByCourse = rawEnrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        Function.identity(),
                        (latest, ignored) -> latest,
                        java.util.LinkedHashMap::new));
        List<Enrollment> enrollments = List.copyOf(enrollmentByCourse.values());
        if (enrollments.isEmpty()) return Collections.emptyList();

        List<UUID> courseIds = enrollments.stream().map(Enrollment::getCourseId).toList();
        Map<UUID, Course> courseById = courseRepository.findByIdIn(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
        List<Course> courses = courseIds.stream()
                .map(courseById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
        Set<UUID> previewCourseIds = findCoursesWithFreePreview(courses);
        Map<UUID, CourseReviewService.RatingSummary> ratingByCourseId = summarizeRatings(courses);
        Map<UUID, Integer> studentCounts = buildStudentCounts(courses);
        Map<UUID, Integer> progressByCourse = courseProgressService.calculateLessonProgressForCourses(
                me.userId(),
                courseIds
        );
        Map<UUID, CertificateEligibilityService.Eligibility> eligibilityByCourse = enrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        certificateEligibilityService::evaluate));
        Map<UUID, Instant> latestActivityByCourse = new HashMap<>();
        mergeLatestActivity(latestActivityByCourse,
                courseProgressItemRepository.findLatestCompletedAtByStudentAndCourseIds(me.userId(), courseIds));
        mergeLatestActivity(latestActivityByCourse,
                studentVideoProgressRepository.findLatestUpdatedAtByStudentAndCourseIds(me.userId(), courseIds));
        mergeLatestActivity(latestActivityByCourse,
                quizAttemptRepository.findLatestActivityByStudentAndCourseIds(me.userId(), courseIds));
        mergeLatestActivity(latestActivityByCourse,
                examAttemptRepository.findLatestActivityByStudentAndCourseIds(me.userId(), courseIds));

        return courses.stream()
                .sorted(Comparator.comparing(
                        (Course course) -> latestActivityByCourse.getOrDefault(
                                course.getId(), enrollmentByCourse.get(course.getId()).getEnrolledAt()),
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(course -> {
                    Enrollment enrollment = enrollmentByCourse.get(course.getId());
                    CourseReviewService.RatingSummary rating = ratingByCourseId.getOrDefault(
                            course.getId(),
                            new CourseReviewService.RatingSummary(0.0, 0)
                    );
                    int progressPct = progressByCourse.getOrDefault(course.getId(), 0);
                    CertificateEligibilityService.Eligibility eligibility =
                            eligibilityByCourse.get(course.getId());
                    boolean finalExamPassed = eligibility != null && eligibility.finalExamPassed();
                    boolean allRequiredExamsPassed = eligibility != null
                            && eligibility.allRequiredExamsPassed();
                    String learningStatus = progressPct == 0
                            ? "not_started"
                            : progressPct >= 100 && allRequiredExamsPassed
                            ? "completed"
                            : "in_progress";
                    Instant purchasedAt = enrollment.getEnrolledAt();
                    Instant lastAccessedAt = latestActivityByCourse.getOrDefault(
                            course.getId(), purchasedAt);
                    return CourseSummaryResponse.fromEntity(
                            course,
                            previewCourseIds.contains(course.getId()),
                            rating.averageRating(),
                            rating.reviewCount(),
                            studentCounts.getOrDefault(course.getId(), 0),
                            progressPct,
                            purchasedAt,
                            lastAccessedAt,
                            learningStatus,
                            finalExamPassed,
                            allRequiredExamsPassed
                    );
                })
                .toList();
    }

    private void mergeLatestActivity(Map<UUID, Instant> target, List<Object[]> rows) {
        for (Object[] row : rows) {
            if (row.length < 2 || !(row[0] instanceof UUID courseId)
                    || !(row[1] instanceof Instant activityAt)) {
                continue;
            }
            target.merge(courseId, activityAt,
                    (current, candidate) -> candidate.isAfter(current) ? candidate : current);
        }
    }

    // ========================================================================
    // Categories (dùng chung qua /api/categories)
    // ========================================================================

    /**
     * Lấy danh sách tất cả category, sắp xếp theo display_order.
     * Dùng cho dropdown filter trong UI.
     */
    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories() {
        return categoryRepository.findAllByOrderByDisplayOrderAsc()
                .stream()
                .map(CategoryResponse::fromEntity)
                .toList();
    }

    private Set<UUID> findCoursesWithFreePreview(List<Course> courses) {
        if (courses == null || courses.isEmpty()) {
            return Collections.emptySet();
        }

        List<UUID> courseIds = courses.stream()
                .map(Course::getId)
                .toList();

        return lessonRepository.countFreePreviewByCourseIds(courseIds).stream()
                .filter(count -> count.getItemCount() > 0)
                .map(CourseContentCount::getCourseId)
                .collect(Collectors.toCollection(HashSet::new));
    }

    /**
     * courseId → số học viên đã ghi danh (1 query batch trên enrollments).
     * Feature riêng của local; team3 đã bỏ studentCount khỏi response.
     */
    private Map<UUID, Integer> buildStudentCounts(List<Course> courses) {
        if (courses == null || courses.isEmpty()) {
            return Collections.emptyMap();
        }
        List<UUID> courseIds = courses.stream().map(Course::getId).toList();
        Map<UUID, Integer> result = new HashMap<>();
        for (Object[] row : enrollmentRepository.countGroupedByCourseId(courseIds)) {
            UUID courseId = row[0] instanceof UUID uuid ? uuid : UUID.fromString(row[0].toString());
            result.put(courseId, ((Number) row[1]).intValue());
        }
        return result;
    }

    private Map<UUID, CourseReviewService.RatingSummary> summarizeRatings(List<Course> courses) {
        if (courses == null || courses.isEmpty()) {
            return Collections.emptyMap();
        }
        List<UUID> courseIds = courses.stream().map(Course::getId).toList();
        return courseReviewRepository
                .summarizeByCourseIds(courseIds, CourseReviewModerationStatus.PUBLISHED).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> new CourseReviewService.RatingSummary(
                                round1(((Number) row[1]).doubleValue()),
                                ((Number) row[2]).longValue()
                        )
                ));
    }

    private double extractAverageRating(Object[] rawRating) {
        if (rawRating == null || rawRating.length < 2 || rawRating[0] == null) return 0.0;
        return round1(((Number) rawRating[0]).doubleValue());
    }

    private long extractReviewCount(Object[] rawRating) {
        if (rawRating == null || rawRating.length < 2 || rawRating[1] == null) return 0;
        return ((Number) rawRating[1]).longValue();
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
