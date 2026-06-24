package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.AdminNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AdminNotificationRepository extends JpaRepository<AdminNotification, UUID> {

    List<AdminNotification> findTop20ByOrderByCreatedAtDesc();

    List<AdminNotification> findTop20ByReadAtIsNullOrderByCreatedAtDesc();

    long countByReadAtIsNull();
}
