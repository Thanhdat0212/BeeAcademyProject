package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ParentStudentLink;
import org.springframework.data.jpa.repository.JpaRepository;
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
    List<ParentStudentLink> findByIdParentId(UUID parentId);

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
}
