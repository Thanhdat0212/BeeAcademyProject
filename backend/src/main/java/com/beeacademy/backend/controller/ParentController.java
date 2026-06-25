package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.dto.response.ParentPaymentHistoryResponse;
import com.beeacademy.backend.dto.response.ParentTeacherConversationResponse;
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
    public ApiResponse<LinkedStudentResponse> unlinkStudent(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                parentService.unlinkStudent(me, studentId),
                "Đã gửi yêu cầu hủy liên kết. Cần học sinh đồng ý để hoàn tất.");
    }

    @PostMapping("/children/{studentId}/unlink-confirm")
    public ApiResponse<LinkedStudentResponse> confirmUnlinkStudent(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                parentService.confirmUnlinkStudent(me, studentId),
                "Đã xác nhận hủy liên kết tài khoản con.");
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

    @GetMapping("/children/{studentId}/payment-history")
    public ApiResponse<ParentPaymentHistoryResponse> getChildPaymentHistory(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildPaymentHistory(me, studentId));
    }

    @GetMapping("/children/{studentId}/teacher-conversations")
    public ApiResponse<List<ParentTeacherConversationResponse>> getChildTeacherConversations(
            @PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildTeacherConversations(me, studentId));
    }

    @PostMapping("/children/{studentId}/teacher-conversations")
    public ApiResponse<ParentTeacherConversationResponse> sendParentTeacherMessage(
            @PathVariable UUID studentId,
            @Valid @RequestBody SendParentTeacherMessageRequest request) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                parentService.sendParentTeacherMessage(me, studentId, request),
                "Đã gửi tin nhắn tới giáo viên.");
    }
}
