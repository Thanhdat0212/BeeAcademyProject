package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.AdminNotificationResponse;
import com.beeacademy.backend.dto.response.AdminNotificationSummaryResponse;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.AdminNotification;
import com.beeacademy.backend.repository.AdminNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminNotificationService {

    private final AdminNotificationRepository notificationRepository;

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
}
