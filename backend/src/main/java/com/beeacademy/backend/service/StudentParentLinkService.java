package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.StudentParentLinkInvitationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentParentLinkService {

    private final ParentStudentLinkRepository linkRepository;
    private final ProfileRepository profileRepository;

    @Transactional(readOnly = true)
    public List<StudentParentLinkInvitationResponse> listPendingInvitations(AuthenticatedUser me) {
        log.info("Student {} requested pending parent link invitations", me.userId());

        return linkRepository.findByIdStudentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(),
                        ParentStudentLinkStatus.PENDING.toDbValue())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public StudentParentLinkInvitationResponse acceptInvitation(AuthenticatedUser me, UUID parentId) {
        ParentStudentLink link = requirePendingInvitation(me.userId(), parentId);
        link.accept();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        log.info("Student {} accepted parent link invitation from {}", me.userId(), parentId);
        return toResponse(savedLink);
    }

    @Transactional
    public StudentParentLinkInvitationResponse rejectInvitation(AuthenticatedUser me, UUID parentId) {
        ParentStudentLink link = requirePendingInvitation(me.userId(), parentId);
        link.reject();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        log.info("Student {} rejected parent link invitation from {}", me.userId(), parentId);
        return toResponse(savedLink);
    }

    private ParentStudentLink requirePendingInvitation(UUID studentId, UUID parentId) {
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_INVITATION_NOT_FOUND",
                        "Không tìm thấy lời mời liên kết từ phụ huynh này.",
                        HttpStatus.NOT_FOUND));

        if (link.getStatus() != ParentStudentLinkStatus.PENDING) {
            throw new BusinessException(
                    "PARENT_LINK_INVITATION_NOT_PENDING",
                    "Lời mời liên kết này đã được xử lý.",
                    HttpStatus.CONFLICT);
        }

        return link;
    }

    private StudentParentLinkInvitationResponse toResponse(ParentStudentLink link) {
        Profile parent = link.getParent();
        String parentEmail = profileRepository.findEmailByUserId(parent.getId()).orElse("");
        return new StudentParentLinkInvitationResponse(
                parent.getId(),
                displayName(parent),
                parentEmail,
                parent.getAvatarUrl(),
                link.getStatus().toApiValue(),
                link.getInvitedAt(),
                link.getRespondedAt());
    }

    private String displayName(Profile profile) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return "Phụ huynh";
        }
        return profile.getFullName();
    }
}
