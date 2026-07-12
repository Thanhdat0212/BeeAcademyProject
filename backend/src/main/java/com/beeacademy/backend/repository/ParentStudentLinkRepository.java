package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository truy vấn bảng liên kết phụ huynh và học sinh {@code parent_student_links}.
 */
@Repository
public interface ParentStudentLinkRepository extends JpaRepository<ParentStudentLink, ParentStudentLink.Id> {
    
    /**
     * Tìm danh sách tất cả các liên kết học sinh của một phụ huynh.
     * 
     * @param parentId UUID của phụ huynh
     * @return Danh sách các đối tượng ParentStudentLink
     */
    List<ParentStudentLink> findByIdParentIdOrderByInvitedAtDesc(UUID parentId);

    @Query(value = """
            SELECT *
            FROM parent_student_links
            WHERE parent_id = :parentId
              AND CAST(status AS text) = :status
            ORDER BY invited_at DESC
            """, nativeQuery = true)
    List<ParentStudentLink> findByIdParentIdAndStatusOrderByInvitedAtDesc(
            @Param("parentId") UUID parentId,
            @Param("status") String status);

    @Query(value = """
            SELECT *
            FROM parent_student_links
            WHERE student_id = :studentId
              AND CAST(status AS text) = :status
            ORDER BY invited_at DESC
            """, nativeQuery = true)
    List<ParentStudentLink> findByIdStudentIdAndStatusOrderByInvitedAtDesc(
            @Param("studentId") UUID studentId,
            @Param("status") String status);

    /**
     * Tìm một liên kết cụ thể giữa một phụ huynh và một học sinh.
     * 
     * @param parentId  UUID của phụ huynh
     * @param studentId UUID của học sinh
     * @return Optional chứa ParentStudentLink nếu tìm thấy
     */
    Optional<ParentStudentLink> findByIdParentIdAndIdStudentId(UUID parentId, UUID studentId);

    /**
     * Kiểm tra xem mối liên kết giữa phụ huynh và học sinh này đã tồn tại trong DB chưa.
     * 
     * @param parentId  UUID của phụ huynh
     * @param studentId UUID của học sinh
     * @return true nếu liên kết đã tồn tại, ngược lại false
     */
    boolean existsByIdParentIdAndIdStudentId(UUID parentId, UUID studentId);

    @Query(value = """
            SELECT EXISTS(
                SELECT 1
                FROM parent_student_links
                WHERE parent_id = :parentId
                  AND student_id = :studentId
                  AND CAST(status AS text) = :status
            )
            """, nativeQuery = true)
    boolean existsByIdParentIdAndIdStudentIdAndStatus(
            @Param("parentId") UUID parentId,
            @Param("studentId") UUID studentId,
            @Param("status") String status);
}
