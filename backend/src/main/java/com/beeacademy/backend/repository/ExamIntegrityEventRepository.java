package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamIntegrityEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ExamIntegrityEventRepository extends JpaRepository<ExamIntegrityEvent, UUID> {

    Optional<ExamIntegrityEvent> findByAttemptIdAndClientEventId(UUID attemptId, UUID clientEventId);

    @Query("""
            SELECT COALESCE(MAX(event.violationCount), 0)
            FROM ExamIntegrityEvent event
            WHERE event.attempt.id = :attemptId
            """)
    int findMaxViolationCountByAttemptId(@Param("attemptId") UUID attemptId);
}
