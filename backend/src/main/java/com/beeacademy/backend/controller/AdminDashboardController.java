package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.AdminOverviewResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller cho Admin Dashboard (UC34).
 * Tất cả endpoint yêu cầu role = admin.
 */
@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminDashboardController {

    private final AdminDashboardService dashboardService;

    /** Toàn bộ số liệu tab Overview trong 1 call — tài chính + đơn gần đây + top khóa học. */
    @GetMapping("/overview")
    public ApiResponse<AdminOverviewResponse> getOverview() {
        return ApiResponse.ok(dashboardService.getOverview());
    }
}
