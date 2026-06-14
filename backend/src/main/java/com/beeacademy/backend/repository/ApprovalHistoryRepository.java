package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ApprovalHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Truy vấn bảng {@code course_approval_history}.
 * Timeline duyệt theo thứ tự thời gian tăng dần (cũ → mới).
 */
@Repository
public interface ApprovalHistoryRepository extends JpaRepository<ApprovalHistory, UUID> {

    /** Lịch sử duyệt của một khóa học, cũ nhất lên đầu. */
    List<ApprovalHistory> findByCourseIdOrderByCreatedAtAsc(UUID courseId);
}
