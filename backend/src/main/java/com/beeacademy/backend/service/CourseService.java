package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.CategoryResponse;
import com.beeacademy.backend.dto.response.CourseDetailResponse;
import com.beeacademy.backend.dto.response.CourseSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.spec.CourseSpecifications;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    private final CourseRepository courseRepository;
    private final CategoryRepository categoryRepository;

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
        return CourseDetailResponse.fromEntity(course, canSeeAllVideos);
    }

    /**
     * Cùng logic nhưng lookup theo slug - dùng cho URL SEO-friendly.
     */
    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetailBySlug(String slug, AuthenticatedUser me) {
        Course course = courseRepository.findWithCategoryAndTeacherBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Course", slug));

        boolean canSeeAllVideos = canUserAccessAllVideos(course, me);
        return CourseDetailResponse.fromEntity(course, canSeeAllVideos);
    }

    // ========================================================================
    // UC08 - Logic phân quyền xem video (xem thử / xem đầy đủ)
    // ========================================================================

    /**
     * Quyết định user có được xem TOÀN BỘ video không.
     *
     * <p>Quy tắc:
     * <ul>
     *   <li>Guest (me=null): KHÔNG → chỉ thấy lesson isFree.</li>
     *   <li>Đã đăng nhập + là TEACHER của khoá: CÓ.</li>
     *   <li>Đã đăng nhập + ADMIN: CÓ.</li>
     *   <li>Đã đăng nhập + đã mua (enrollment): CÓ. <b>GĐ này chưa có
     *       enrollment table</b> → tạm coi là KHÔNG, sẽ bổ sung ở Module 3
     *       (Mua hàng & Thanh toán).</li>
     * </ul>
     */
    private boolean canUserAccessAllVideos(Course course, AuthenticatedUser me) {
        if (me == null) return false;

        // Admin xem tất cả
        if ("admin".equalsIgnoreCase(me.role())) return true;

        // Chính giáo viên của khoá
        if (course.getTeacher() != null && course.getTeacher().getId().equals(me.userId())) {
            return true;
        }

        // TODO Module 3: check enrollments table
        return false;
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
