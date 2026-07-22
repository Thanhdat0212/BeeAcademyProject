package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.GradeAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GradeAuditLogRepository extends JpaRepository<GradeAuditLog, UUID> {
}
