package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.dto.response.ParentPaymentHistoryResponse;
import com.beeacademy.backend.dto.response.ParentTeacherConversationResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ParentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
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

    @DeleteMapping("/link-invitations/{studentId}")
    public ApiResponse<Void> cancelLinkInvitation(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        parentService.cancelLinkInvitation(me, studentId);
        return ApiResponse.ok(null, "Da huy loi moi lien ket dang cho hoc sinh xac nhan.");
    }

    @PostMapping("/children/{studentId}/unlink")
    public ApiResponse<LinkedStudentResponse> revokeStudentLink(
            @PathVariable UUID studentId,
            @Valid @RequestBody RevokeParentStudentLinkRequest request) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                parentService.revokeStudentLink(me, studentId, request),
                "Đã hủy liên kết với học sinh.");
    }

    @GetMapping("/children/{studentId}/overview")
    public ApiResponse<ChildOverviewResponse> getChildOverview(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildOverview(me, studentId));
    }

    @GetMapping("/children/{studentId}/progress-report")
    public ApiResponse<ChildProgressReportResponse> getChildProgressReport(
            @PathVariable UUID studentId,
            @RequestParam(required = false) UUID courseId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildProgressReport(me, studentId, courseId, from, to));
    }

    @GetMapping(
            value = "/children/{studentId}/progress-report/export",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> exportChildProgressReport(
            @PathVariable UUID studentId,
            @RequestParam(required = false) UUID courseId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        AuthenticatedUser me = CurrentUser.required();
        byte[] workbook = parentService.exportChildProgressReportExcel(me, studentId, courseId, from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"parent-progress-" + studentId + ".xlsx\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentLength(workbook.length)
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(workbook);
    }

    @GetMapping("/children/{studentId}/payment-history")
    public ApiResponse<ParentPaymentHistoryResponse> getChildPaymentHistory(
            @PathVariable UUID studentId,
            @RequestParam(required = false) UUID courseId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildPaymentHistory(me, studentId, courseId, from, to));
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
    @PostMapping(value = "/message-attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UploadResponse> uploadMessageAttachment(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(parentService.uploadMessageAttachment(CurrentUser.required(), file));
    }
}
