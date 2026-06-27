package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ParentLinkAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ParentLinkAuditLogRepository extends JpaRepository<ParentLinkAuditLog, UUID> {
}
