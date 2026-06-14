package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.CategoryResponse;
import com.beeacademy.backend.dto.response.CourseDetailResponse;
import com.beeacademy.backend.dto.response.CourseSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.repository.spec.CourseSpecifications;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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
    private final CourseDocumentRepository documentRepository;
    private final QuizConfigRepository     quizConfigRepository;
    private final SupabaseStorageClient    storageClient;

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
     * @param keyword       từ khoá tìm kiếm, nullable
     * @param pageable      paging + sort do controller pass xuống
     * @return PageResponse chứa CourseSummaryResponse
     */
    @Transactional(readOnly = true)
    public PageResponse<CourseSummaryResponse> searchCourses(String subjectSlug,
                                                              Integer grade,
                                                              String keyword,
                                                              Pageable pageable) {
        // Build spec composable. Specification.where() có thể nhận null spec -
        // trả về spec "always true" → khởi đầu sạch.
        Specification<Course> spec = Specification.where(CourseSpecifications.onlyPublished())
                .and(CourseSpecifications.matchCategorySlug(subjectSlug))
                .and(CourseSpecifications.matchGrade(grade))
                .and(CourseSpecifications.matchKeyword(keyword));

        Page<Course> coursePage = courseRepository.findAll(spec, pageable);
        log.debug("Search courses: subject={}, grade={}, q={}, found={}",
                subjectSlug, grade, keyword, coursePage.getTotalElements());

        // Map qua DTO. Lưu ý: page query mặc định không JOIN FETCH category/teacher
        // → nếu truy cập course.getCategory().getName() sẽ trigger N+1.
        // GIẢI PHÁP: ở GĐ này dữ liệu nhỏ (9 mock courses) chấp nhận N+1.
        // Khi scale, thêm @EntityGraph trên một method findAll Specification tuỳ chỉnh.
        return PageResponse.of(coursePage, CourseSummaryResponse::fromEntity);
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

        boolean canSeeAllVideos = canUserAccessAllVideos(course, me);
        return CourseDetailResponse.fromEntity(course, canSeeAllVideos,
                buildUrlResolver(canSeeAllVideos), buildDocMap(course),
                buildChaptersWithQuiz(course));
    }

    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetailBySlug(String slug, AuthenticatedUser me) {
        Course course = courseRepository.findWithCategoryAndTeacherBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Course", slug));

        boolean canSeeAllVideos = canUserAccessAllVideos(course, me);
        return CourseDetailResponse.fromEntity(course, canSeeAllVideos,
                buildUrlResolver(canSeeAllVideos), buildDocMap(course),
                buildChaptersWithQuiz(course));
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
        if (!canSeeAll) return null;
        return lesson -> {
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
        return courseRepository.findEnrolledByStudentId(me.userId())
                .stream()
                .map(CourseSummaryResponse::fromEntity)
                .toList();
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
}
