package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.TeacherBankAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TeacherBankAuditLogRepository extends JpaRepository<TeacherBankAuditLog, UUID> {

    List<TeacherBankAuditLog> findByTeacherIdOrderByChangedAtDesc(UUID teacherId);
}
