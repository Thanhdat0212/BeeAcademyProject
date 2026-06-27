package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentParentLinkInvitationResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentParentLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/student/parent-link-invitations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentParentLinkController {

    private final StudentParentLinkService studentParentLinkService;

    @GetMapping
    public ApiResponse<List<StudentParentLinkInvitationResponse>> listPendingInvitations() {
        return ApiResponse.ok(studentParentLinkService.listPendingInvitations(CurrentUser.required()));
    }

    @GetMapping("/linked-parents")
    public ApiResponse<List<StudentParentLinkInvitationResponse>> listLinkedParents() {
        return ApiResponse.ok(studentParentLinkService.listLinkedParents(CurrentUser.required()));
    }

    @PostMapping("/{parentId}/accept")
    public ApiResponse<StudentParentLinkInvitationResponse> acceptInvitation(@PathVariable UUID parentId) {
        return ApiResponse.ok(
                studentParentLinkService.acceptInvitation(CurrentUser.required(), parentId),
                "Đã chấp nhận lời mời liên kết phụ huynh.");
    }

    @PostMapping("/{parentId}/reject")
    public ApiResponse<StudentParentLinkInvitationResponse> rejectInvitation(@PathVariable UUID parentId) {
        return ApiResponse.ok(
                studentParentLinkService.rejectInvitation(CurrentUser.required(), parentId),
                "Đã từ chối lời mời liên kết phụ huynh.");
    }

    @PostMapping("/{parentId}/unlink-request")
    public ApiResponse<StudentParentLinkInvitationResponse> requestUnlink(@PathVariable UUID parentId) {
        return ApiResponse.ok(
                studentParentLinkService.requestUnlink(CurrentUser.required(), parentId),
                "Đã gửi yêu cầu hủy liên kết. Cần phụ huynh đồng ý để hoàn tất.");
    }

    @PostMapping("/{parentId}/unlink-confirm")
    public ApiResponse<StudentParentLinkInvitationResponse> confirmUnlink(@PathVariable UUID parentId) {
        return ApiResponse.ok(
                studentParentLinkService.confirmUnlink(CurrentUser.required(), parentId),
                "Đã xác nhận hủy liên kết phụ huynh.");
    }
}
