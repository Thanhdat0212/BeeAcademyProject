package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QuestionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QuestionAuditLogRepository extends JpaRepository<QuestionAuditLog, UUID> {

    List<QuestionAuditLog> findByQuestionIdOrderByCreatedAtDesc(UUID questionId);
}
