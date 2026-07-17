package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CountPointResponse;
import com.beeacademy.backend.dto.response.RevenueTrendPointResponse;
import com.beeacademy.backend.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller cho trang Báo cáo & Thống kê của Admin (UC37).
 * Tất cả endpoint yêu cầu role = admin. Chỉ đọc số liệu tổng hợp cho biểu đồ.
 */
@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminAnalyticsController {

    private final AdminAnalyticsService analyticsService;

    /** GMV / phần GV / phí nền tảng theo tháng. */
    @GetMapping("/revenue-trend")
    public ApiResponse<List<RevenueTrendPointResponse>> getRevenueTrend() {
        return ApiResponse.ok(analyticsService.getRevenueTrend());
    }

    /** Lượt đăng ký theo tháng. */
    @GetMapping("/enrollment-trend")
    public ApiResponse<List<CountPointResponse>> getEnrollmentTrend() {
        return ApiResponse.ok(analyticsService.getEnrollmentTrend());
    }

    /** Người dùng mới theo tháng. */
    @GetMapping("/user-growth")
    public ApiResponse<List<CountPointResponse>> getUserGrowth() {
        return ApiResponse.ok(analyticsService.getUserGrowth());
    }

    /** Số khóa học theo danh mục. */
    @GetMapping("/courses-by-category")
    public ApiResponse<List<CountPointResponse>> getCoursesByCategory() {
        return ApiResponse.ok(analyticsService.getCoursesByCategory());
    }
}
