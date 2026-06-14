package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CategoryResponse;
import com.beeacademy.backend.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller cho danh mục môn học.
 *
 * <p>Public endpoint - dùng cho dropdown filter ở
 * {@link CourseController#searchCourses}. Frontend gọi 1 lần khi load
 * trang Courses để populate filter.
 */
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    /**
     * Re-use {@code CourseService.listCategories} vì categories là sub-domain
     * gọn của courses (không có UC riêng đáng kể). Sau này tách
     * {@code CategoryService} khi có thêm logic (vd: count khoá học theo
     * category, CRUD admin).
     */
    private final CourseService courseService;

    @GetMapping
    public ApiResponse<List<CategoryResponse>> listAll() {
        return ApiResponse.ok(courseService.listCategories());
    }
}
