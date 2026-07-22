package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.ParentLinkAuditLog;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ParentLinkAuditLogRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentParentLinkServiceTest {

    @Mock
    private ParentStudentLinkRepository linkRepository;

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private ParentLinkAuditLogRepository auditLogRepository;

    @Mock
    private UserNotificationService notificationService;

    @InjectMocks
    private StudentParentLinkService service;

    @Test
    void listPendingInvitationsKeepsExpiredInvitationVisible() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink expired = pendingLink(parentId, studentId);
        ReflectionTestUtils.setField(expired, "invitedAt", Instant.now().minus(Duration.ofDays(8)));
        when(linkRepository.findByIdStudentIdAndStatusesOrderByInvitedAtDesc(
                studentId,
                List.of(
                        ParentStudentLinkStatus.PENDING.toDbValue(),
                        ParentStudentLinkStatus.EXPIRED.toDbValue())))
                .thenReturn(List.of(expired));
        when(linkRepository.saveAndFlush(expired)).thenReturn(expired);
        when(profileRepository.findEmailByUserId(parentId)).thenReturn(Optional.of("parent@example.com"));

        var invitations = service.listPendingInvitations(studentUser(studentId));

        assertThat(invitations).hasSize(1);
        assertThat(invitations.get(0).status()).isEqualTo("expired");
        assertThat(invitations.get(0).expired()).isTrue();
        verify(auditLogRepository).save(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void acceptInvitationRejectsExpiredPendingLink() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink link = pendingLink(parentId, studentId);
        ReflectionTestUtils.setField(link, "invitedAt", Instant.now().minusSeconds(8 * 24 * 60 * 60));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(linkRepository.saveAndFlush(link)).thenReturn(link);

        assertThatThrownBy(() -> service.acceptInvitation(studentUser(studentId), parentId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_LINK_INVITATION_EXPIRED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.GONE);
                });

        verify(linkRepository).saveAndFlush(link);
        verify(auditLogRepository).save(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void acceptInvitationWritesAuditLogAndNotifiesParent() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink link = pendingLink(parentId, studentId);
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(linkRepository.saveAndFlush(link)).thenReturn(link);
        when(profileRepository.findEmailByUserId(parentId)).thenReturn(Optional.of("parent@example.com"));

        Instant decisionStartedAt = Instant.now();
        var response = service.acceptInvitation(studentUser(studentId), parentId);

        assertThat(response.status()).isEqualTo(ParentStudentLinkStatus.ACTIVE.toApiValue());
        assertThat(response.expired()).isFalse();
        assertThat(response.expiresAt()).isEqualTo(link.getInvitedAt().plusSeconds(7 * 24 * 60 * 60));

        ArgumentCaptor<ParentLinkAuditLog> auditCaptor = ArgumentCaptor.forClass(ParentLinkAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getParentId()).isEqualTo(parentId);
        assertThat(auditCaptor.getValue().getStudentId()).isEqualTo(studentId);
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("accept_invitation");
        assertThat(auditCaptor.getValue().getOldStatus()).isEqualTo("pending");
        assertThat(auditCaptor.getValue().getNewStatus()).isEqualTo("active");

        verify(notificationService).notify(
                parentId,
                "parent_link_accepted",
                "Học sinh đã chấp nhận liên kết",
                "Student One đã chấp nhận lời mời liên kết phụ huynh.",
                "/parent/link");
        assertThat(Duration.between(decisionStartedAt, Instant.now()))
                .isLessThanOrEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void rejectInvitationWritesAuditLogAndNotifiesParent() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink link = pendingLink(parentId, studentId);
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(linkRepository.saveAndFlush(link)).thenReturn(link);
        when(profileRepository.findEmailByUserId(parentId)).thenReturn(Optional.of("parent@example.com"));

        Instant decisionStartedAt = Instant.now();
        var response = service.rejectInvitation(studentUser(studentId), parentId);

        assertThat(response.status()).isEqualTo("rejected");
        ArgumentCaptor<ParentLinkAuditLog> auditCaptor = ArgumentCaptor.forClass(ParentLinkAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("reject_invitation");
        assertThat(auditCaptor.getValue().getOldStatus()).isEqualTo("pending");
        assertThat(auditCaptor.getValue().getNewStatus()).isEqualTo("rejected");
        verify(notificationService).notify(
                parentId,
                "parent_link_rejected",
                "Học sinh đã từ chối liên kết",
                "Student One đã từ chối lời mời liên kết phụ huynh.",
                "/parent/link");
        assertThat(Duration.between(decisionStartedAt, Instant.now()))
                .isLessThanOrEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void studentCanImmediatelyRevokeActiveLinkWithOptionalReason() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID operationId = UUID.randomUUID();
        ParentStudentLink link = activeLink(parentId, studentId);
        when(linkRepository.findForUpdate(parentId, studentId)).thenReturn(Optional.of(link));
        when(linkRepository.saveAndFlush(link)).thenReturn(link);
        when(profileRepository.findEmailByUserId(parentId)).thenReturn(Optional.of("parent@example.com"));

        var response = service.revokeParentLink(
                studentUser(studentId),
                parentId,
                new RevokeParentStudentLinkRequest(operationId, "  Không còn nhu cầu liên kết.  "));

        assertThat(response.status()).isEqualTo("revoked");
        ArgumentCaptor<ParentLinkAuditLog> auditCaptor = ArgumentCaptor.forClass(ParentLinkAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("revoke_link");
        assertThat(auditCaptor.getValue().getOldStatus()).isEqualTo("active");
        assertThat(auditCaptor.getValue().getNewStatus()).isEqualTo("revoked");
        assertThat(auditCaptor.getValue().getOperationId()).isEqualTo(operationId);
        assertThat(auditCaptor.getValue().getReason()).isEqualTo("Không còn nhu cầu liên kết.");
        verify(notificationService).notify(
                parentId,
                "parent_link_revoked",
                "Liên kết đã bị hủy",
                "Liên kết với Student One đã bị hủy.",
                "/parent/link");
    }

    @Test
    void automaticRetryDoesNotDuplicateStudentRevocationSideEffects() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID operationId = UUID.randomUUID();
        ParentStudentLink link = activeLink(parentId, studentId);
        link.revoke();
        when(linkRepository.findForUpdate(parentId, studentId)).thenReturn(Optional.of(link));
        when(auditLogRepository.existsByParentIdAndStudentIdAndActorIdAndActionAndOperationId(
                parentId, studentId, studentId, "revoke_link", operationId)).thenReturn(true);
        when(profileRepository.findEmailByUserId(parentId)).thenReturn(Optional.of("parent@example.com"));

        var response = service.revokeParentLink(
                studentUser(studentId),
                parentId,
                new RevokeParentStudentLinkRequest(operationId, null));

        assertThat(response.status()).isEqualTo("revoked");
        verify(linkRepository, never()).saveAndFlush(any());
        verify(auditLogRepository, never()).save(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void newOperationCannotRevokeAnAlreadyRevokedLink() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink link = activeLink(parentId, studentId);
        link.revoke();
        when(linkRepository.findForUpdate(parentId, studentId)).thenReturn(Optional.of(link));

        assertThatThrownBy(() -> service.revokeParentLink(
                studentUser(studentId),
                parentId,
                new RevokeParentStudentLinkRequest(UUID.randomUUID(), null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_LINK_ALREADY_REVOKED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(linkRepository, never()).saveAndFlush(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    private ParentStudentLink pendingLink(UUID parentId, UUID studentId) {
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        return ParentStudentLink.createPendingInvitation(parent, student);
    }

    private ParentStudentLink activeLink(UUID parentId, UUID studentId) {
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        return ParentStudentLink.createActiveLink(parent, student);
    }

    private AuthenticatedUser studentUser(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", UserRole.STUDENT.name().toLowerCase());
    }
}
