package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ParentProgressAccessAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ParentProgressAccessAuditRepository extends JpaRepository<ParentProgressAccessAudit, UUID> {
}
