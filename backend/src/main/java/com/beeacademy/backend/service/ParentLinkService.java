package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ParentLinkAuditLog;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
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
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentLinkService {

    private static final Duration LINK_INVITATION_TTL = Duration.ofDays(7);
    private static final int MAX_ACTIVE_OR_PENDING_CHILDREN = 5;
    private static final int MAX_INVITATION_ATTEMPTS_PER_DAY = 5;
    private static final String NEUTRAL_INVITATION_MESSAGE =
            "Nếu tài khoản học sinh hợp lệ, hệ thống đã gửi yêu cầu liên kết.";

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final ParentLinkAuditLogRepository parentLinkAuditLogRepository;
    private final ParentLinkInvitationEmailService parentLinkInvitationEmailService;
    private final UserNotificationService notificationService;

    @Transactional(readOnly = true)
    public List<LinkedStudentResponse> getLinkedChildren(AuthenticatedUser me) {
        log.info("Parent {} requested linked children list", me.userId());
        return linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(), ParentStudentLinkStatus.ACTIVE.toDbValue())
                .stream()
                .map(this::toLinkedStudentResponse)
                .toList();
    }

    @Transactional
    public List<ParentLinkInvitationResponse> getLinkInvitations(AuthenticatedUser me) {
        log.info("Parent {} requested pending link invitations", me.userId());
        return linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(), ParentStudentLinkStatus.PENDING.toDbValue())
                .stream()
                .map(link -> expireIfPending(link, me.userId(), UserRole.PARENT, "expire_link_invitation"))
                .filter(link -> link.getStatus() == ParentStudentLinkStatus.PENDING)
                .map(this::toParentLinkInvitationResponse)
                .toList();
    }

    @Transactional
    public ParentLinkInvitationResponse sendLinkInvitation(
            AuthenticatedUser me,
            SendParentLinkInvitationRequest request) {
        String normalizedEmail = request.studentEmail().trim().toLowerCase();
        log.info("Parent {} requested link invitation for {}", me.userId(), normalizedEmail);

        auditParentLinkAttempt(me.userId(), "send_link_invitation_attempt");
        if (recentInvitationAttemptCount(me.userId()) > MAX_INVITATION_ATTEMPTS_PER_DAY) {
            auditParentLinkAttempt(me.userId(), "send_link_invitation_rate_limited");
            return ParentLinkInvitationResponse.neutral(normalizedEmail, NEUTRAL_INVITATION_MESSAGE);
        }

        Optional<UUID> maybeStudentId = profileRepository.findUserIdByEmail(normalizedEmail);
        if (maybeStudentId.isEmpty()) {
            auditParentLinkAttempt(me.userId(), "send_link_invitation_neutral_not_found");
            return ParentLinkInvitationResponse.neutral(normalizedEmail, NEUTRAL_INVITATION_MESSAGE);
        }

        UUID studentId = maybeStudentId.get();
        Profile student = profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
        if (student.getRole() != UserRole.STUDENT) {
            auditParentLinkAttempt(me.userId(), "send_link_invitation_neutral_wrong_role");
            return ParentLinkInvitationResponse.neutral(normalizedEmail, NEUTRAL_INVITATION_MESSAGE);
        }

        ParentStudentLink existingLink = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElse(null);
        if (existingLink != null && existingLink.getStatus() == ParentStudentLinkStatus.PENDING) {
            existingLink = expireIfPending(existingLink, me.userId(), UserRole.PARENT, "expire_link_invitation");
        }
        if (existingLink != null
                && (existingLink.getStatus() == ParentStudentLinkStatus.ACTIVE
                || existingLink.getStatus() == ParentStudentLinkStatus.PENDING)) {
            throw new BusinessException(
                    "PARENT_LINK_ALREADY_EXISTS",
                    "Da co loi moi hoac lien ket dang hoat dong voi hoc sinh nay.",
                    HttpStatus.CONFLICT);
        }

        Profile parent = requireParentProfile(me.userId());
        List<ParentStudentLink> pendingChildren = linkRepository
                .findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(), ParentStudentLinkStatus.PENDING.toDbValue())
                .stream()
                .map(link -> expireIfPending(link, me.userId(), UserRole.PARENT, "expire_link_invitation"))
                .filter(link -> link.getStatus() == ParentStudentLinkStatus.PENDING)
                .toList();
        long activeOrPendingChildren = linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(), ParentStudentLinkStatus.ACTIVE.toDbValue())
                .size() + pendingChildren.size();
        if (activeOrPendingChildren >= MAX_ACTIVE_OR_PENDING_CHILDREN) {
            throw new BusinessException(
                    "PARENT_CHILD_LIMIT_EXCEEDED",
                    "A parent can have at most 5 active or pending child links.",
                    HttpStatus.CONFLICT);
        }

        String relationship = normalizeRelationship(request.relationship());
        String note = normalizeNote(request.note());
        ParentStudentLink link = existingLink == null
                ? ParentStudentLink.createPendingInvitation(parent, student, relationship, note)
                : existingLink;
        ParentStudentLinkStatus oldStatus = link.getStatus();
        if (existingLink != null) {
            existingLink.markPending(relationship, note);
        }

        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(
                savedLink,
                me.userId(),
                UserRole.PARENT,
                existingLink == null ? "send_link_invitation" : "resend_link_invitation",
                oldStatus,
                savedLink.getStatus());
        parentLinkInvitationEmailService.sendInvitation(
                normalizedEmail, displayName(student), displayName(parent));
        notificationService.notify(
                studentId,
                "parent_link_invitation",
                "Parent link invitation",
                displayName(parent) + " invited you to link parent account on Bee Academy.",
                "/student/notifications");
        return toParentLinkInvitationResponse(savedLink, normalizedEmail);
    }

    @Transactional
    public void cancelLinkInvitation(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested cancel pending link invitation for student {}", me.userId(), studentId);
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_INVITATION_NOT_FOUND",
                        "Pending parent-student link invitation was not found.",
                        HttpStatus.NOT_FOUND));
        if (link.getStatus() != ParentStudentLinkStatus.PENDING) {
            throw new BusinessException(
                    "PARENT_LINK_INVITATION_NOT_PENDING",
                    "Only pending invitations can be cancelled.",
                    HttpStatus.CONFLICT);
        }

        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.revoke();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(
                savedLink,
                me.userId(),
                UserRole.PARENT,
                "cancel_link_invitation",
                oldStatus,
                savedLink.getStatus());
    }

    @Transactional
    public LinkedStudentResponse revokeStudentLink(
            AuthenticatedUser me,
            UUID studentId,
            RevokeParentStudentLinkRequest request) {
        log.info("Parent {} is revoking active link with student {}", me.userId(), studentId);
        ParentStudentLink link = linkRepository.findForUpdate(me.userId(), studentId)
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_NOT_FOUND",
                        "Không tìm thấy liên kết với học sinh này.",
                        HttpStatus.NOT_FOUND));
        if (isIdempotentRevocationRetry(link, me.userId(), request.operationId())) {
            return toLinkedStudentResponse(link);
        }
        requireRevocableStatus(link);

        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.revoke();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        parentLinkAuditLogRepository.save(ParentLinkAuditLog.create(
                savedLink,
                me.userId(),
                UserRole.PARENT,
                "revoke_link",
                oldStatus,
                savedLink.getStatus(),
                request.operationId(),
                request.reason()));
        notifyStudentAboutUnlink(savedLink);
        log.info("Parent {} revoked link with student {}", me.userId(), studentId);
        return toLinkedStudentResponse(savedLink);
    }

    private void auditParentLinkAttempt(UUID parentId, String action) {
        parentLinkAuditLogRepository.save(ParentLinkAuditLog.createAttempt(
                parentId, parentId, UserRole.PARENT, action));
    }

    private long recentInvitationAttemptCount(UUID parentId) {
        return parentLinkAuditLogRepository.countRecentActions(
                parentId,
                List.of("send_link_invitation_attempt"),
                Instant.now().minus(Duration.ofDays(1)));
    }

    private void auditStatusChange(
            ParentStudentLink link,
            UUID actorId,
            UserRole actorRole,
            String action,
            ParentStudentLinkStatus oldStatus,
            ParentStudentLinkStatus newStatus) {
        parentLinkAuditLogRepository.save(ParentLinkAuditLog.create(
                link, actorId, actorRole, action, oldStatus, newStatus));
    }

    private ParentStudentLink expireIfPending(
            ParentStudentLink link,
            UUID actorId,
            UserRole actorRole,
            String action) {
        if (link.getStatus() != ParentStudentLinkStatus.PENDING || !isExpired(link)) {
            return link;
        }
        ParentStudentLinkStatus oldStatus = link.getStatus();
        link.expire();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        auditStatusChange(savedLink, actorId, actorRole, action, oldStatus, savedLink.getStatus());
        return savedLink;
    }

    private void notifyStudentAboutUnlink(ParentStudentLink link) {
        notificationService.notify(
                link.getStudent().getId(),
                "parent_link_revoked",
                "Lien ket phu huynh da bi huy",
                "Lien ket voi " + displayName(link.getParent(), "phu huynh") + " da bi huy.",
                "/student/notifications");
    }

    private boolean isIdempotentRevocationRetry(
            ParentStudentLink link,
            UUID actorId,
            UUID operationId) {
        return link.getStatus() == ParentStudentLinkStatus.REVOKED
                && parentLinkAuditLogRepository
                .existsByParentIdAndStudentIdAndActorIdAndActionAndOperationId(
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

    private Profile requireParentProfile(UUID parentId) {
        return profileRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", parentId));
    }

    private LinkedStudentResponse toLinkedStudentResponse(ParentStudentLink link) {
        Profile student = link.getStudent();
        return LinkedStudentResponse.builder()
                .id(student.getId())
                .name(displayName(student))
                .avatarUrl(student.getAvatarUrl())
                .code("")
                .grade(resolveGradeLabel(student.getId()))
                .linkStatus(link.getStatus().toApiValue())
                .unlinkRequestedById(link.getUnlinkRequestedBy())
                .unlinkRequestedByRole(resolveUnlinkRequestedByRole(link))
                .unlinkRequestedAt(link.getUnlinkRequestedAt())
                .build();
    }

    private ParentLinkInvitationResponse toParentLinkInvitationResponse(ParentStudentLink link) {
        String studentEmail = profileRepository.findEmailByUserId(link.getStudent().getId()).orElse("");
        return toParentLinkInvitationResponse(link, studentEmail);
    }

    private ParentLinkInvitationResponse toParentLinkInvitationResponse(
            ParentStudentLink link,
            String studentEmail) {
        Profile student = link.getStudent();
        return new ParentLinkInvitationResponse(
                student.getId(),
                displayName(student),
                studentEmail,
                student.getAvatarUrl(),
                resolveGradeLabel(student.getId()),
                link.getRelationship(),
                link.getNote(),
                link.getStatus().toApiValue(),
                link.getInvitedAt(),
                expiresAt(link),
                isExpired(link),
                link.getRespondedAt(),
                link.getUnlinkRequestedBy(),
                resolveUnlinkRequestedByRole(link),
                link.getUnlinkRequestedAt(),
                true,
                null);
    }

    private Instant expiresAt(ParentStudentLink link) {
        return link.getInvitedAt() == null ? null : link.getInvitedAt().plus(LINK_INVITATION_TTL);
    }

    private boolean isExpired(ParentStudentLink link) {
        Instant expiresAt = expiresAt(link);
        return expiresAt != null && expiresAt.isBefore(Instant.now());
    }

    private String normalizeRelationship(String relationship) {
        if (relationship == null || relationship.isBlank()) {
            return "guardian";
        }
        String normalized = relationship.trim().toLowerCase();
        if (!List.of("father", "mother", "guardian").contains(normalized)) {
            throw new BusinessException(
                    "INVALID_RELATIONSHIP",
                    "Relationship must be father, mother, or guardian.",
                    HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        String normalized = note.trim();
        return normalized.length() <= 500 ? normalized : normalized.substring(0, 500);
    }

    private String resolveUnlinkRequestedByRole(ParentStudentLink link) {
        UUID requestedBy = link.getUnlinkRequestedBy();
        if (requestedBy == null) {
            return null;
        }
        if (requestedBy.equals(link.getParent().getId())) {
            return "parent";
        }
        return requestedBy.equals(link.getStudent().getId()) ? "student" : null;
    }

    private String resolveGradeLabel(UUID studentId) {
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        if (enrollments.isEmpty()) {
            return "";
        }
        List<UUID> courseIds = enrollments.stream()
                .map(Enrollment::getCourseId)
                .distinct()
                .toList();
        return courseIds.isEmpty() ? "" : resolveGradeLabel(courseRepository.findByIdIn(courseIds));
    }

    private String resolveGradeLabel(List<Course> courses) {
        List<Integer> grades = courses.stream()
                .flatMap(course -> Arrays.stream(course.getGrades()).boxed())
                .distinct()
                .sorted()
                .toList();
        if (grades.isEmpty()) {
            return "";
        }
        if (grades.size() == 1) {
            return "Lớp " + grades.get(0);
        }
        return "Lớp " + grades.get(0) + "-" + grades.get(grades.size() - 1);
    }

    private String displayName(Profile profile) {
        return displayName(profile, "Học sinh");
    }

    private String displayName(Profile profile, String fallback) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return fallback;
        }
        return profile.getFullName();
    }
}
