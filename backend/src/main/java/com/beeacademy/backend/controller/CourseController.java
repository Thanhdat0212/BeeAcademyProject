package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CourseDetailResponse;
import com.beeacademy.backend.dto.response.CourseSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller cho khoá học (Module 2 - UC06, UC07, UC08).
 *
 * <p>Tất cả endpoint là PUBLIC (guest vẫn truy cập được - cấu hình ở
 * {@code SecurityConfig}). Logic phân quyền xem video chi tiết do
 * {@code CourseService} xử lý dựa trên {@link AuthenticatedUser} (có thể null).
 */
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    /**
     * UC06 - Tìm kiếm + lọc + phân trang khoá học.
     *
     * <p>Query params (tất cả optional):
     * <ul>
     *   <li>{@code subject}: slug danh mục (vd: "toan-hoc")</li>
     *   <li>{@code grade}: số lớp (6-9)</li>
     *   <li>{@code q}: từ khoá tìm kiếm trong title/description</li>
     *   <li>{@code page} (default 0), {@code size} (default 12), {@code sort}
     *       (default: "createdAt,desc") - Spring tự bind vào Pageable.</li>
     * </ul>
     *
     * <p>{@code @PageableDefault} đặt giá trị mặc định khi frontend không
     * truyền. {@code size=12} hợp với grid 4 cột x 3 hàng trên desktop.
     */
    @GetMapping
    public ApiResponse<PageResponse<CourseSummaryResponse>> searchCourses(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) Integer grade,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 12, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        PageResponse<CourseSummaryResponse> page =
                courseService.searchCourses(subject, grade, q, pageable);
        return ApiResponse.ok(page);
    }

    /**
     * UC07 + UC08 - Chi tiết khoá học theo UUID.
     *
     * <p>Frontend gửi UUID. URL có dạng {@code /api/courses/{uuid}}.
     * Endpoint không yêu cầu JWT - {@link CurrentUser#optional} trả null
     * nếu guest, service xử lý phân biệt quyền xem video.
     */
    @GetMapping("/{id}")
    public ApiResponse<CourseDetailResponse> getCourseDetail(@PathVariable UUID id) {
        AuthenticatedUser me = CurrentUser.optional();  // null cho guest
        return ApiResponse.ok(courseService.getCourseDetail(id, me));
    }

    /**
     * Cùng UC07 nhưng theo slug (SEO-friendly URL).
     *
     * <p>Path {@code /by-slug/{slug}} để phân biệt với {@code /{id}} -
     * tránh ambiguity vì cả UUID và slug đều là string.
     */
    @GetMapping("/by-slug/{slug}")
    public ApiResponse<CourseDetailResponse> getCourseDetailBySlug(@PathVariable String slug) {
        AuthenticatedUser me = CurrentUser.optional();
        return ApiResponse.ok(courseService.getCourseDetailBySlug(slug, me));
    }
}
