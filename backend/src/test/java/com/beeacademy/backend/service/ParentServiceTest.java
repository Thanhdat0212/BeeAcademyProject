package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.EnrollmentRepository;
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
class ParentServiceTest {

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private ParentStudentLinkRepository linkRepository;

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private ParentLinkInvitationEmailService parentLinkInvitationEmailService;

    @Mock
    private UserNotificationService notificationService;

    @InjectMocks
    private ParentService service;

    @Test
    void sendLinkInvitationStoresRelationshipNoteAndNotifiesStudent() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.empty());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.ACCEPTED.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.PENDING.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.saveAndFlush(any(ParentStudentLink.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of());

        var response = service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest(" STUDENT@example.com ", "mother", "Can theo doi tien do."));

        assertThat(response.studentId()).isEqualTo(studentId);
        assertThat(response.relationship()).isEqualTo("mother");
        assertThat(response.note()).isEqualTo("Can theo doi tien do.");
        assertThat(response.status()).isEqualTo("pending");
        assertThat(response.expiresAt()).isEqualTo(response.invitedAt().plusSeconds(7 * 24 * 60 * 60));
        assertThat(response.expired()).isFalse();

        ArgumentCaptor<ParentStudentLink> linkCaptor = ArgumentCaptor.forClass(ParentStudentLink.class);
        verify(linkRepository).saveAndFlush(linkCaptor.capture());
        assertThat(linkCaptor.getValue().getRelationship()).isEqualTo("mother");
        assertThat(linkCaptor.getValue().getNote()).isEqualTo("Can theo doi tien do.");

        verify(parentLinkInvitationEmailService).sendInvitation(
                "student@example.com",
                "Student One",
                "Parent One");
        verify(notificationService).notify(
                studentId,
                "parent_link_invitation",
                "Parent link invitation",
                "Parent One invited you to link parent account on Bee Academy.",
                "/student/notifications");
    }

    @Test
    void sendLinkInvitationRejectsExistingPendingInvitation() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink pending = ParentStudentLink.createPendingInvitation(parent, student);

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest("student@example.com", "father", null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_LINK_ALREADY_EXISTS");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(linkRepository, never()).saveAndFlush(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void sendLinkInvitationRejectsWhenParentAlreadyHasFiveChildren() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        List<ParentStudentLink> accepted = List.of(
                ParentStudentLink.createAcceptedLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S1")),
                ParentStudentLink.createAcceptedLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S2")),
                ParentStudentLink.createAcceptedLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S3")),
                ParentStudentLink.createAcceptedLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S4")));
        List<ParentStudentLink> pending = List.of(
                ParentStudentLink.createPendingInvitation(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S5")));

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.empty());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.ACCEPTED.toDbValue()))
                .thenReturn(accepted);
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.PENDING.toDbValue()))
                .thenReturn(pending);

        assertThatThrownBy(() -> service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest("student@example.com", "guardian", null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_CHILD_LIMIT_EXCEEDED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(linkRepository, never()).saveAndFlush(any());
    }

    private AuthenticatedUser parentUser(UUID parentId) {
        return new AuthenticatedUser(parentId, "parent@example.com", "parent");
    }
}
