package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ApprovalHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApprovalHistoryRepository extends JpaRepository<ApprovalHistory, UUID> {

    List<ApprovalHistory> findByCourseIdOrderByCreatedAtAsc(UUID courseId);
}
