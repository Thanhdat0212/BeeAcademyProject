package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ParentLinkAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.UUID;

@Repository
public interface ParentLinkAuditLogRepository extends JpaRepository<ParentLinkAuditLog, UUID> {

    boolean existsByParentIdAndStudentIdAndActorIdAndActionAndOperationId(
            UUID parentId,
            UUID studentId,
            UUID actorId,
            String action,
            UUID operationId);

    @Query("""
            SELECT COUNT(log)
            FROM ParentLinkAuditLog log
            WHERE log.actorId = :actorId
              AND log.action IN :actions
              AND log.createdAt >= :since
            """)
    long countRecentActions(
            @Param("actorId") UUID actorId,
            @Param("actions") Collection<String> actions,
            @Param("since") Instant since);
}
