package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.dto.response.ParentPaymentHistoryResponse;
import com.beeacademy.backend.dto.response.ParentTeacherConversationResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ParentService {

    private final ParentLinkService parentLinkService;
    private final ParentProgressService parentProgressService;
    private final ParentPaymentService parentPaymentService;
    private final ParentTeacherMessagingService parentTeacherMessagingService;

    @Transactional(readOnly = true)
    public List<LinkedStudentResponse> getLinkedChildren(AuthenticatedUser me) {
        return parentLinkService.getLinkedChildren(me);
    }

    @Transactional
    public List<ParentLinkInvitationResponse> getLinkInvitations(AuthenticatedUser me) {
        return parentLinkService.getLinkInvitations(me);
    }

    @Transactional
    public ParentLinkInvitationResponse sendLinkInvitation(
            AuthenticatedUser me,
            SendParentLinkInvitationRequest request) {
        return parentLinkService.sendLinkInvitation(me, request);
    }

    @Transactional
    public void cancelLinkInvitation(AuthenticatedUser me, UUID studentId) {
        parentLinkService.cancelLinkInvitation(me, studentId);
    }

    @Transactional
    public LinkedStudentResponse revokeStudentLink(
            AuthenticatedUser me,
            UUID studentId,
            RevokeParentStudentLinkRequest request) {
        return parentLinkService.revokeStudentLink(me, studentId, request);
    }

    @Transactional
    public ChildOverviewResponse getChildOverview(AuthenticatedUser me, UUID studentId) {
        return parentProgressService.getChildOverview(me, studentId);
    }

    @Transactional
    public ChildProgressReportResponse getChildProgressReport(AuthenticatedUser me, UUID studentId) {
        return parentProgressService.getChildProgressReport(me, studentId);
    }

    @Transactional
    public ChildProgressReportResponse getChildProgressReport(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        return parentProgressService.getChildProgressReport(me, studentId, courseFilterId, from, to);
    }

    @Transactional
    public byte[] exportChildProgressReportExcel(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        return parentProgressService.exportChildProgressReportExcel(
                me, studentId, courseFilterId, from, to);
    }

    @Transactional(readOnly = true)
    public ParentPaymentHistoryResponse getChildPaymentHistory(AuthenticatedUser me, UUID studentId) {
        return parentPaymentService.getChildPaymentHistory(me, studentId);
    }

    @Transactional(readOnly = true)
    public ParentPaymentHistoryResponse getChildPaymentHistory(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        return parentPaymentService.getChildPaymentHistory(me, studentId, courseFilterId, from, to);
    }

    @Transactional(readOnly = true)
    public List<ParentTeacherConversationResponse> getChildTeacherConversations(
            AuthenticatedUser me,
            UUID studentId) {
        return parentTeacherMessagingService.getChildTeacherConversations(me, studentId);
    }

    @Transactional
    public ParentTeacherConversationResponse sendParentTeacherMessage(
            AuthenticatedUser me,
            UUID studentId,
            SendParentTeacherMessageRequest request) {
        return parentTeacherMessagingService.sendParentTeacherMessage(me, studentId, request);
    }

    public UploadResponse uploadMessageAttachment(AuthenticatedUser me, MultipartFile file) {
        return parentTeacherMessagingService.uploadMessageAttachment(me, file);
    }
}
