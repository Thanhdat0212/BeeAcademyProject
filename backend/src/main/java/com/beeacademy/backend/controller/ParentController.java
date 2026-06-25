package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ParentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/parent")
@RequiredArgsConstructor
@PreAuthorize("hasRole('parent')")
public class ParentController {

    private final ParentService parentService;

    @GetMapping("/children")
    public ApiResponse<List<LinkedStudentResponse>> getLinkedChildren() {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getLinkedChildren(me));
    }

    @GetMapping("/link-invitations")
    public ApiResponse<List<ParentLinkInvitationResponse>> getLinkInvitations() {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getLinkInvitations(me));
    }

    @PostMapping("/link-invitations")
    public ApiResponse<ParentLinkInvitationResponse> sendLinkInvitation(
            @Valid @RequestBody SendParentLinkInvitationRequest request) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                parentService.sendLinkInvitation(me, request),
                "Đã gửi lời mời liên kết cho học sinh.");
    }

    @DeleteMapping("/children/{studentId}")
    public ApiResponse<Void> unlinkStudent(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        parentService.unlinkStudent(me, studentId);
        return ApiResponse.ok(null, "Gỡ liên kết tài khoản con thành công!");
    }

    @GetMapping("/children/{studentId}/overview")
    public ApiResponse<ChildOverviewResponse> getChildOverview(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildOverview(me, studentId));
    }

    @GetMapping("/children/{studentId}/progress-report")
    public ApiResponse<ChildProgressReportResponse> getChildProgressReport(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildProgressReport(me, studentId));
    }
}
