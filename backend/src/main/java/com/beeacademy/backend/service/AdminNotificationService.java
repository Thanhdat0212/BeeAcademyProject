package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.BroadcastNotificationRequest;
import com.beeacademy.backend.dto.response.AdminNotificationResponse;
import com.beeacademy.backend.dto.response.AdminNotificationSummaryResponse;
import com.beeacademy.backend.dto.response.BroadcastNotificationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.AdminNotification;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AdminNotificationRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private static final String TARGET_ALL = "ALL";

    private final AdminNotificationRepository notificationRepository;
    private final ProfileRepository profileRepository;
    private final UserNotificationService userNotificationService;

    @Transactional(readOnly = true)
    public AdminNotificationSummaryResponse list(boolean unreadOnly) {
        List<AdminNotification> notifications = unreadOnly
                ? notificationRepository.findTop20ByReadAtIsNullOrderByCreatedAtDesc()
                : notificationRepository.findTop20ByOrderByCreatedAtDesc();

        return new AdminNotificationSummaryResponse(
                notificationRepository.countByReadAtIsNull(),
                notifications.stream()
                        .map(AdminNotificationResponse::fromEntity)
                        .toList()
        );
    }

    @Transactional
    public AdminNotificationResponse markRead(UUID notificationId) {
        AdminNotification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("AdminNotification", notificationId));
        notification.markRead();
        return AdminNotificationResponse.fromEntity(notificationRepository.save(notification));
    }

    @Transactional
    public BroadcastNotificationResponse broadcast(BroadcastNotificationRequest request) {
        String rawRole = request.targetRole().trim().toUpperCase();

        List<Profile> recipients;
        if (TARGET_ALL.equals(rawRole)) {
            recipients = profileRepository.findAll().stream()
                    .filter(profile -> profile.getRole() != UserRole.ADMIN)
                    .toList();
        } else {
            UserRole role = UserRole.fromDbValue(rawRole);
            if (role == null || role == UserRole.ADMIN) {
                throw new BusinessException("INVALID_TARGET_ROLE",
                        "Đối tượng nhận không hợp lệ. Chỉ hỗ trợ ALL, STUDENT, TEACHER, PARENT.");
            }
            recipients = profileRepository.findByRole(role);
        }

        for (Profile recipient : recipients) {
            userNotificationService.notifyProfile(
                    recipient,
                    "admin_broadcast",
                    request.title(),
                    request.body(),
                    request.targetUrl()
            );
        }

        return new BroadcastNotificationResponse(recipients.size());
    }
}
