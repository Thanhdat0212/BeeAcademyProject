package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.UpdateParentSensitiveDataConsentRequest;
import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentParentLinkInvitationResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentParentLinkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @PostMapping("/{parentId}/unlink")
    public ApiResponse<StudentParentLinkInvitationResponse> revokeParentLink(
            @PathVariable UUID parentId,
            @Valid @RequestBody RevokeParentStudentLinkRequest request) {
        return ApiResponse.ok(
                studentParentLinkService.revokeParentLink(CurrentUser.required(), parentId, request),
                "Đã hủy liên kết với phụ huynh.");
    }

    @PostMapping("/{parentId}/sensitive-data-consent")
    public ApiResponse<StudentParentLinkInvitationResponse> updateSensitiveDataConsent(
            @PathVariable UUID parentId,
            @Valid @RequestBody UpdateParentSensitiveDataConsentRequest request) {
        return ApiResponse.ok(
                studentParentLinkService.updateSensitiveDataConsent(
                        CurrentUser.required(),
                        parentId,
                        request.consentGranted()),
                "Đã cập nhật quyền xem dữ liệu nhạy cảm cho phụ huynh.");
    }
}
