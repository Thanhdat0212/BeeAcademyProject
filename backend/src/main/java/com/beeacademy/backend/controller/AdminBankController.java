package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.BankReviewRequest;
import com.beeacademy.backend.dto.response.AdminBankAccountResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.TeacherBankService;
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
 * Admin duyệt TK ngân hàng GV (REQ-ADM-006 AC6): TK ở trạng thái PENDING
 * giữ (hold) chi trả cho tới khi được duyệt.
 */
@RestController
@RequestMapping("/api/admin/bank-accounts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminBankController {

    private final TeacherBankService teacherBankService;

    @GetMapping("/pending")
    public ApiResponse<List<AdminBankAccountResponse>> listPending() {
        return ApiResponse.ok(teacherBankService.listPendingBankAccounts());
    }

    @PatchMapping("/{teacherId}/review")
    public ApiResponse<AdminBankAccountResponse> review(
            @PathVariable UUID teacherId,
            @Valid @RequestBody BankReviewRequest request) {
        UUID adminId = CurrentUser.required().userId();
        AdminBankAccountResponse reviewed = teacherBankService.reviewBankAccount(
                teacherId, Boolean.TRUE.equals(request.approve()), request.note(), adminId);
        return ApiResponse.ok(reviewed,
                Boolean.TRUE.equals(request.approve())
                        ? "Đã duyệt TK ngân hàng của giáo viên"
                        : "Đã từ chối TK ngân hàng của giáo viên");
    }
}
