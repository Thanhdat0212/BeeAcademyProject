package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ConfirmPayoutRequest;
import com.beeacademy.backend.dto.response.AdminPayoutRowResponse;
import com.beeacademy.backend.dto.response.AdminPayoutStatsResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AdminPayoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Đối soát & chi lương GV (UC37/39/40).
 */
@RestController
@RequestMapping("/api/admin/payouts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminPayoutController {

    private final AdminPayoutService payoutService;

    /** Toàn bộ kỳ đối soát (mới nhất trước) — frontend tự lọc theo tên GV / trạng thái. */
    @GetMapping
    public ApiResponse<List<AdminPayoutRowResponse>> list() {
        return ApiResponse.ok(payoutService.listPayouts());
    }

    /** 3 thẻ thống kê đầu trang. */
    @GetMapping("/stats")
    public ApiResponse<AdminPayoutStatsResponse> stats() {
        return ApiResponse.ok(payoutService.getStats());
    }

    /** Xác nhận đã chuyển khoản thủ công cho GV (UC40). */
    @PatchMapping("/{periodId}/confirm")
    public ApiResponse<AdminPayoutRowResponse> confirm(@PathVariable UUID periodId,
                                                       @Valid @RequestBody ConfirmPayoutRequest req) {
        UUID adminId = CurrentUser.required().userId();
        return ApiResponse.ok(payoutService.confirmPayout(periodId, req, adminId),
                "Đã xác nhận chuyển khoản cho giáo viên");
    }
}
