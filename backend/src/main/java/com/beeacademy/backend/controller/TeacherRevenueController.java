package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CountPointResponse;
import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.dto.response.RevenueTrendPointResponse;
import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.TeacherAccessService;
import com.beeacademy.backend.service.TeacherRevenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/revenue")
@RequiredArgsConstructor
public class TeacherRevenueController {

    private final TeacherRevenueService revenueService;
    private final TeacherAccessService teacherAccessService;

    private UUID requireApprovedTeacherId() {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        return me.userId();
    }

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
        UUID teacherId = requireApprovedTeacherId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getTeacherStats(teacherId)));
    }

    /** Toàn bộ giao dịch (dùng cho trang /teacher/revenue tab Chi tiết). */
    @GetMapping("/splits")
    public ResponseEntity<ApiResponse<List<RevenueSplitResponse>>> getSplits() {
        UUID teacherId = requireApprovedTeacherId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getSplits(teacherId)));
    }

    /** Danh sách kỳ thanh toán (dùng cho trang /teacher/revenue tab Kỳ thanh toán). */
    @GetMapping("/periods")
    public ResponseEntity<ApiResponse<List<PayoutPeriodResponse>>> getPeriods() {
        UUID teacherId = requireApprovedTeacherId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getPeriods(teacherId)));
    }

    /** Doanh thu theo tháng — biểu đồ đường/vùng trên dashboard & trang doanh thu. */
    @GetMapping("/trend")
    public ResponseEntity<ApiResponse<List<RevenueTrendPointResponse>>> getRevenueTrend() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getRevenueTrend(teacherId)));
    }

    /** Lượt đăng ký theo tháng — biểu đồ đường trên dashboard. */
    @GetMapping("/enrollment-trend")
    public ResponseEntity<ApiResponse<List<CountPointResponse>>> getEnrollmentTrend() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(revenueService.getEnrollmentTrend(teacherId)));
    }

    @GetMapping("/periods/{periodId}/splits")
    public ResponseEntity<ApiResponse<List<RevenueSplitResponse>>> getConfirmedPeriodSplits(
            @PathVariable UUID periodId) {
        UUID teacherId = requireApprovedTeacherId();
        return ResponseEntity.ok(ApiResponse.ok(
                revenueService.getConfirmedPeriodSplits(teacherId, periodId)));
    }

    @GetMapping(value = "/periods/{periodId}/export", produces = "application/vnd.ms-excel")
    public ResponseEntity<String> exportConfirmedPeriod(@PathVariable UUID periodId) {
        UUID teacherId = requireApprovedTeacherId();
        String workbook = revenueService.exportConfirmedPeriodExcel(teacherId, periodId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"teacher-payout-" + periodId + ".xls\"")
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(workbook);
    }
}
