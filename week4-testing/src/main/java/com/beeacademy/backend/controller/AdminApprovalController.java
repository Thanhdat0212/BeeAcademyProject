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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/courses/pending")
    public ApiResponse<PageResponse<PendingCourseResponse>> getPendingCourses(
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.ASC)
            Pageable pageable) {
        return ApiResponse.ok(approvalService.getPendingCourses(pageable));
    }

    @GetMapping("/courses/{courseId}/approval-history")
    public ApiResponse<List<ApprovalHistoryResponse>> getHistory(@PathVariable UUID courseId) {
        return ApiResponse.ok(approvalService.getHistory(courseId));
    }

    @PostMapping("/courses/{courseId}/approve")
    public ApiResponse<Void> approve(
            @PathVariable UUID courseId,
            @Valid @RequestBody(required = false) ApprovalActionRequest req) {
        String comment = req != null ? req.comment() : null;
        approvalService.approve(courseId, CurrentUser.required(), comment);
        return ApiResponse.ok(null, "Đã duyệt và xuất bản khóa học thành công");
    }

    @PostMapping("/courses/{courseId}/reject")
    public ApiResponse<Void> reject(
            @PathVariable UUID courseId,
            @Valid @RequestBody ApprovalActionRequest req) {
        approvalService.reject(courseId, CurrentUser.required(), req.comment());
        return ApiResponse.ok(null, "Đã từ chối khóa học");
    }

    @PostMapping("/courses/{courseId}/revise")
    public ApiResponse<Void> revise(
            @PathVariable UUID courseId,
            @Valid @RequestBody ApprovalActionRequest req) {
        approvalService.revise(courseId, CurrentUser.required(), req.comment());
        return ApiResponse.ok(null, "Đã yêu cầu giáo viên chỉnh sửa");
    }
}
