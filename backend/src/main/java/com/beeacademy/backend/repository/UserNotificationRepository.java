package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {

    List<UserNotification> findTop30ByRecipientIdOrderByCreatedAtDesc(UUID recipientId);

    List<UserNotification> findTop30ByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(UUID recipientId);

    Optional<UserNotification> findByIdAndRecipientId(UUID id, UUID recipientId);
}
