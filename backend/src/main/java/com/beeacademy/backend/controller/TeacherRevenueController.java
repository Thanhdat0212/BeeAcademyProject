package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.TeacherRevenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/revenue")
@RequiredArgsConstructor
public class TeacherRevenueController {

    private final TeacherRevenueService revenueService;

    /**
     * Tổng hợp tất cả số liệu dashboard trong 1 request.
     *
     * <p>Thay thế việc frontend gọi 3 API riêng (/splits, /periods, /courses)
     * rồi tính toán client-side. Server tổng hợp 1 lần, trả 1 response.
     *
     * <p>Response gồm: doanh thu tháng này/trước, số học viên unique,
     * lượt bán tháng này/trước, số khóa đang bán, enrollment per course,
     * và 8 giao dịch gần nhất.
     */
    @GetMapping("/stats/overview")
    public ResponseEntity<ApiResponse<TeacherStatsResponse>> getStatsOverview() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getTeacherStats(teacherId)));
    }

    /** Toàn bộ giao dịch (dùng cho trang /teacher/revenue tab Chi tiết). */
    @GetMapping("/splits")
    public ResponseEntity<ApiResponse<List<RevenueSplitResponse>>> getSplits() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getSplits(teacherId)));
    }

    /** Danh sách kỳ thanh toán (dùng cho trang /teacher/revenue tab Kỳ thanh toán). */
    @GetMapping("/periods")
    public ResponseEntity<ApiResponse<List<PayoutPeriodResponse>>> getPeriods() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getPeriods(teacherId)));
    }
}
