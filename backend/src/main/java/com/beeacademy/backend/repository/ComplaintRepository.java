package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Complaint;
import com.beeacademy.backend.model.ComplaintStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComplaintRepository
        extends JpaRepository<Complaint, UUID>, JpaSpecificationExecutor<Complaint> {

    /** Danh sách khiếu nại của một người gửi (kèm thread đầy đủ). */
    @EntityGraph(attributePaths = {"sender", "messages", "messages.author"})
    @Query("SELECT DISTINCT c FROM Complaint c WHERE c.sender.id = :senderId " +
           "ORDER BY c.lastActivityAt DESC")
    List<Complaint> findBySenderId(@Param("senderId") UUID senderId);

    /** Một khiếu nại kèm toàn bộ thread — dùng cho màn chi tiết. */
    @EntityGraph(attributePaths = {"sender", "messages", "messages.author"})
    @Query("SELECT c FROM Complaint c WHERE c.id = :id")
    Optional<Complaint> findDetailedById(@Param("id") UUID id);

    long countByStatus(ComplaintStatus status);
}
