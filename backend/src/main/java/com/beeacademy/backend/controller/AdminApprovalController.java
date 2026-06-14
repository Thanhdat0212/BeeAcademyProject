package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ApprovalActionRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ApprovalHistoryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.PendingCourseResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST controller cho Admin duyệt khóa học (Phase 3 — UC36).
 * Tất cả endpoint yêu cầu role = admin.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminApprovalController {

    private final ApprovalService approvalService;

    /** Danh sách khóa học đang chờ duyệt, cũ nhất lên đầu (FIFO). */
    @GetMapping("/courses/pending")
    public ApiResponse<PageResponse<PendingCourseResponse>> getPendingCourses(
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.ASC)
            Pageable pageable) {
        return ApiResponse.ok(approvalService.getPendingCourses(pageable));
    }

    /** Lịch sử duyệt của một khóa học (timeline). */
    @GetMapping("/courses/{courseId}/approval-history")
    public ApiResponse<List<ApprovalHistoryResponse>> getHistory(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(approvalService.getHistory(courseId));
    }

    /** Admin duyệt → khóa học được PUBLISHED. */
    @PostMapping("/courses/{courseId}/approve")
    public ApiResponse<Void> approve(
            @PathVariable UUID courseId,
            @Valid @RequestBody(required = false) ApprovalActionRequest req) {
        String comment = req != null ? req.comment() : null;
        approvalService.approve(courseId, CurrentUser.required(), comment);
        return ApiResponse.ok(null, "Đã duyệt và xuất bản khóa học thành công");
    }

    /** Admin từ chối (bắt buộc có comment). */
    @PostMapping("/courses/{courseId}/reject")
    public ApiResponse<Void> reject(
            @PathVariable UUID courseId,
            @Valid @RequestBody ApprovalActionRequest req) {
        approvalService.reject(courseId, CurrentUser.required(), req.comment());
        return ApiResponse.ok(null, "Đã từ chối khóa học");
    }

    /** Admin yêu cầu GV sửa lại (bắt buộc có comment). */
    @PostMapping("/courses/{courseId}/revise")
    public ApiResponse<Void> revise(
            @PathVariable UUID courseId,
            @Valid @RequestBody ApprovalActionRequest req) {
        approvalService.revise(courseId, CurrentUser.required(), req.comment());
        return ApiResponse.ok(null, "Đã yêu cầu giáo viên chỉnh sửa");
    }
}
