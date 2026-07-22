package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.StudentParentLinkInvitationResponse;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentParentLinkService {

    private static final Duration INVITATION_TTL = Duration.ofDays(7);

    private final ParentStudentLinkRepository linkRepository;
    private final ProfileRepository profileRepository;
    private final ParentLinkAuditLogRepository auditLogRepository;
    private final UserNotificationService notificationService;

    @Transactional
    public List<StudentParentLinkInvitationResponse> listPendingInvitations(AuthenticatedUser me) {
        log.info("Student {} requested pending parent link invitations", me.userId());

        return linkRepository.findByIdStudentIdAndStatusesOrderByInvitedAtDesc(
                        me.userId(),
                        List.of(
                                ParentStudentLinkStatus.PENDING.toDbValue(),
                                ParentStudentLinkStatus.EXPIRED.toDbValue()))
                .stream()
                .map(link -> expireIfPending(link, me.userId(), "expire_invitation"))
                .filter(link -> link.getStatus() == ParentStudentLinkStatus.PENDING
                        || link.getStatus() == ParentStudentLinkStatus.EXPIRED)
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudentParentLinkInvitationResponse> listLinkedParents(AuthenticatedUser me) {
        log.info("Student {} requested active parent links", me.userId());

        return linkRepository.findByIdStudentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(),
                        ParentStudentLinkStatus.ACTIVE.toDbValue())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public StudentParentLinkInvitationResponse acceptInvitation(AuthenticatedUser me, UUID parentId) {
        ParentStudentLink link = requirePendingInvitation(me.userId(), parentId);
        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.accept();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(savedLink, me.userId(), "accept_invitation", oldStatus, savedLink.getStatus());
        notifyParentAboutDecision(savedLink, true);
        log.info("Student {} accepted parent link invitation from {}", me.userId(), parentId);
        return toResponse(savedLink);
    }

    @Transactional
    public StudentParentLinkInvitationResponse rejectInvitation(AuthenticatedUser me, UUID parentId) {
        ParentStudentLink link = requirePendingInvitation(me.userId(), parentId);
        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.reject();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(savedLink, me.userId(), "reject_invitation", oldStatus, savedLink.getStatus());
        notifyParentAboutDecision(savedLink, false);
        log.info("Student {} rejected parent link invitation from {}", me.userId(), parentId);
        return toResponse(savedLink);
    }

    @Transactional
    public StudentParentLinkInvitationResponse revokeParentLink(
            AuthenticatedUser me,
            UUID parentId,
            RevokeParentStudentLinkRequest request) {
        ParentStudentLink link = linkRepository.findForUpdate(parentId, me.userId())
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_NOT_FOUND",
                        "Không tìm thấy liên kết với phụ huynh này.",
                        HttpStatus.NOT_FOUND));

        if (isIdempotentRevocationRetry(link, me.userId(), request.operationId())) {
            return toResponse(link);
        }
        requireRevocableStatus(link);

        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.revoke();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditLogRepository.save(ParentLinkAuditLog.create(
                savedLink,
                me.userId(),
                UserRole.STUDENT,
                "revoke_link",
                oldStatus,
                savedLink.getStatus(),
                request.operationId(),
                request.reason()));
        notifyParentAboutUnlink(savedLink);
        log.info("Student {} revoked link with parent {}", me.userId(), parentId);
        return toResponse(savedLink);
    }

    @Transactional
    public StudentParentLinkInvitationResponse updateSensitiveDataConsent(
            AuthenticatedUser me,
            UUID parentId,
            boolean consentGranted) {
        ParentStudentLink link = requireActiveLink(me.userId(), parentId);
        link.updateSensitiveDataConsent(consentGranted);
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(
                savedLink,
                me.userId(),
                consentGranted ? "grant_sensitive_data_consent" : "revoke_sensitive_data_consent",
                savedLink.getStatus(),
                savedLink.getStatus());
        log.info(
                "Student {} {} sensitive data consent for parent {}",
                me.userId(),
                consentGranted ? "granted" : "revoked",
                parentId);
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

        if (isExpired(link)) {
            ParentStudentLinkStatus oldStatus = link.getStatus();
            link.expire();
            ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
            auditStatusChange(savedLink, studentId, "expire_invitation", oldStatus, savedLink.getStatus());
            throw new BusinessException(
                    "PARENT_LINK_INVITATION_EXPIRED",
                    "Yêu cầu liên kết đã hết hạn. Vui lòng nhờ phụ huynh gửi lại lời mời.",
                    HttpStatus.GONE);
        }

        return link;
    }

    private ParentStudentLink expireIfPending(ParentStudentLink link, UUID actorId, String action) {
        if (link.getStatus() != ParentStudentLinkStatus.PENDING || !isExpired(link)) {
            return link;
        }

        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.expire();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(savedLink, actorId, action, oldStatus, savedLink.getStatus());
        return savedLink;
    }

    private boolean isExpired(ParentStudentLink link) {
        Instant invitedAt = link.getInvitedAt();
        return invitedAt != null && invitedAt.plus(INVITATION_TTL).isBefore(Instant.now());
    }

    private void auditStatusChange(ParentStudentLink link, UUID actorId, String action,
                                   ParentStudentLinkStatus oldStatus,
                                   ParentStudentLinkStatus newStatus) {
        auditLogRepository.save(ParentLinkAuditLog.create(
                link,
                actorId,
                UserRole.STUDENT,
                action,
                oldStatus,
                newStatus));
    }

    private void notifyParentAboutDecision(ParentStudentLink link, boolean accepted) {
        Profile parent = link.getParent();
        Profile student = link.getStudent();
        String studentName = studentDisplayName(student);
        String title = accepted
                ? "Học sinh đã chấp nhận liên kết"
                : "Học sinh đã từ chối liên kết";
        String body = accepted
                ? "%s đã chấp nhận lời mời liên kết phụ huynh.".formatted(studentName)
                : "%s đã từ chối lời mời liên kết phụ huynh.".formatted(studentName);

        notificationService.notify(
                parent.getId(),
                accepted ? "parent_link_accepted" : "parent_link_rejected",
                title,
                body,
                "/parent/link");
    }

    private void notifyParentAboutUnlink(ParentStudentLink link) {
        notificationService.notify(
                link.getParent().getId(),
                "parent_link_revoked",
                "Liên kết đã bị hủy",
                "Liên kết với " + studentDisplayName(link.getStudent()) + " đã bị hủy.",
                "/parent/link");
    }

    private boolean isIdempotentRevocationRetry(
            ParentStudentLink link,
            UUID actorId,
            UUID operationId) {
        return link.getStatus() == ParentStudentLinkStatus.REVOKED
                && auditLogRepository.existsByParentIdAndStudentIdAndActorIdAndActionAndOperationId(
                        link.getParent().getId(),
                        link.getStudent().getId(),
                        actorId,
                        "revoke_link",
                        operationId);
    }

    private void requireRevocableStatus(ParentStudentLink link) {
        if (link.getStatus() == ParentStudentLinkStatus.ACTIVE) {
            return;
        }

        String code = switch (link.getStatus()) {
            case REVOKED -> "PARENT_LINK_ALREADY_REVOKED";
            case REJECTED -> "PARENT_LINK_REJECTED";
            case EXPIRED -> "PARENT_LINK_EXPIRED";
            default -> "PARENT_LINK_NOT_ACTIVE";
        };
        String message = switch (link.getStatus()) {
            case REVOKED -> "Liên kết này đã được hủy trước đó.";
            case REJECTED -> "Lời mời liên kết này đã bị từ chối.";
            case EXPIRED -> "Lời mời liên kết này đã hết hạn.";
            default -> "Chỉ có thể hủy liên kết đang hoạt động.";
        };
        throw new BusinessException(code, message, HttpStatus.CONFLICT);
    }

    private ParentStudentLink requireActiveLink(UUID studentId, UUID parentId) {
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_NOT_FOUND",
                        "Không tìm thấy liên kết phụ huynh này.",
                        HttpStatus.NOT_FOUND));

        if (link.getStatus() != ParentStudentLinkStatus.ACTIVE) {
            throw new BusinessException(
                    "PARENT_LINK_NOT_ACTIVE",
                    "Liên kết phụ huynh này không còn hoạt động.",
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
                link.getRelationship(),
                link.getNote(),
                link.getStatus().toApiValue(),
                link.getInvitedAt(),
                expiresAt(link),
                link.getStatus() == ParentStudentLinkStatus.EXPIRED || isExpired(link),
                link.getRespondedAt(),
                link.getUnlinkRequestedBy(),
                resolveUnlinkRequestedByRole(link),
                link.getUnlinkRequestedAt(),
                link.isSensitiveDataConsentGranted(),
                link.getSensitiveDataConsentUpdatedAt());
    }

    private Instant expiresAt(ParentStudentLink link) {
        return link.getInvitedAt() == null ? null : link.getInvitedAt().plus(INVITATION_TTL);
    }

    private String resolveUnlinkRequestedByRole(ParentStudentLink link) {
        UUID requestedBy = link.getUnlinkRequestedBy();
        if (requestedBy == null) {
            return null;
        }
        if (requestedBy.equals(link.getParent().getId())) {
            return "parent";
        }
        if (requestedBy.equals(link.getStudent().getId())) {
            return "student";
        }
        return null;
    }

    private String studentDisplayName(Profile profile) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return "Học sinh";
        }
        return profile.getFullName();
    }

    private String displayName(Profile profile) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return "Phụ huynh";
        }
        return profile.getFullName();
    }
}
