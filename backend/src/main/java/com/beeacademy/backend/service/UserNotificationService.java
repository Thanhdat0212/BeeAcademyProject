package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.UserNotificationResponse;
import com.beeacademy.backend.dto.response.UserNotificationSummaryResponse;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserNotification;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserNotificationService {

    private final UserNotificationRepository notificationRepository;
    private final ProfileRepository profileRepository;

    @Transactional
    public void notify(UUID recipientId, String type, String title, String body, String targetUrl) {
        Profile recipient = profileRepository.findById(recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", recipientId));
        notificationRepository.save(UserNotification.create(recipient, type, title, body, targetUrl));
    }

    @Transactional(readOnly = true)
    public UserNotificationSummaryResponse list(UUID recipientId, boolean unreadOnly) {
        var notifications = (unreadOnly
                ? notificationRepository.findTop30ByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(recipientId)
                : notificationRepository.findTop30ByRecipientIdOrderByCreatedAtDesc(recipientId))
                .stream()
                .map(UserNotificationResponse::fromEntity)
                .toList();
        long unreadCount = notificationRepository
                .findTop30ByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(recipientId)
                .size();
        return new UserNotificationSummaryResponse(unreadCount, notifications);
    }

    @Transactional
    public UserNotificationResponse markRead(UUID recipientId, UUID notificationId) {
        UserNotification notification = notificationRepository.findByIdAndRecipientId(notificationId, recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("UserNotification", notificationId));
        notification.markRead();
        return UserNotificationResponse.fromEntity(notificationRepository.save(notification));
    }
}
