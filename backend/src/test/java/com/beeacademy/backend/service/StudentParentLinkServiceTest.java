package com.beeacademy.backend.service;

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

import java.time.Instant;
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
    void acceptInvitationRejectsExpiredPendingLink() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        ParentStudentLink link = pendingLink(parentId, studentId);
        ReflectionTestUtils.setField(link, "invitedAt", Instant.now().minusSeconds(8 * 24 * 60 * 60));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));

        assertThatThrownBy(() -> service.acceptInvitation(studentUser(studentId), parentId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_LINK_INVITATION_EXPIRED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.GONE);
                });

        verify(linkRepository, never()).saveAndFlush(any());
        verify(auditLogRepository, never()).save(any());
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

        var response = service.acceptInvitation(studentUser(studentId), parentId);

        assertThat(response.status()).isEqualTo(ParentStudentLinkStatus.ACCEPTED.toApiValue());
        assertThat(response.expired()).isFalse();
        assertThat(response.expiresAt()).isEqualTo(link.getInvitedAt().plusSeconds(7 * 24 * 60 * 60));

        ArgumentCaptor<ParentLinkAuditLog> auditCaptor = ArgumentCaptor.forClass(ParentLinkAuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getParentId()).isEqualTo(parentId);
        assertThat(auditCaptor.getValue().getStudentId()).isEqualTo(studentId);
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("accept_invitation");
        assertThat(auditCaptor.getValue().getOldStatus()).isEqualTo("pending");
        assertThat(auditCaptor.getValue().getNewStatus()).isEqualTo("accepted");

        verify(notificationService).notify(
                parentId,
                "parent_link_accepted",
                "Hoc sinh da chap nhan lien ket",
                "Student One da chap nhan loi moi lien ket phu huynh.",
                "/parent/link");
    }

    private ParentStudentLink pendingLink(UUID parentId, UUID studentId) {
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        return ParentStudentLink.createPendingInvitation(parent, student);
    }

    private AuthenticatedUser studentUser(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", UserRole.STUDENT.name().toLowerCase());
    }
}
