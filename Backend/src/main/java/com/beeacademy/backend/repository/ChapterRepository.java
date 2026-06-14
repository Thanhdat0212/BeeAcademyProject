package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Chapter;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code chapters}.
 *
 * <p>Cung cấp:
 * <ul>
 *   <li>Lookup theo chapterId + courseId để verify ownership (GV chỉ sửa chapter
 *       thuộc khóa của mình).</li>
 *   <li>Lookup kèm lessons (JOIN FETCH) để tránh N+1 khi map DTO.</li>
 * </ul>
 */
@Repository
public interface ChapterRepository extends JpaRepository<Chapter, UUID> {

    /**
     * Tìm chapter theo ID và courseId — dùng để verify chapter thuộc đúng khoá học.
     * Trả empty nếu chapter không tồn tại hoặc không thuộc courseId.
     */
    Optional<Chapter> findByIdAndCourseId(UUID chapterId, UUID courseId);

    /**
     * Tất cả chapters của một khoá học, sắp xếp theo position ASC.
     * Dùng để tính position tiếp theo khi thêm chapter mới.
     */
    List<Chapter> findByCourseIdOrderByPositionAsc(UUID courseId);

    int countByCourseId(UUID courseId);

    @Query("""
           SELECT ch.course.id AS courseId, COUNT(ch.id) AS itemCount
           FROM Chapter ch
           WHERE ch.course.id IN :courseIds
           GROUP BY ch.course.id
           """)
    List<CourseContentCount> countByCourseIds(@Param("courseIds") List<UUID> courseIds);

    /**
     * Chapters kèm lessons (JOIN FETCH) — tránh N+1 khi render curriculum accordion.
     * Dùng ở trang chi tiết khóa học phía GV.
     */
    @EntityGraph(attributePaths = "lessons")
    List<Chapter> findWithLessonsByCourseId(UUID courseId);

    /**
     * Load chapter kèm course trong 1 query — dùng khi cần truy cập
     * chapter.getCourse() ngay sau đó (tránh N+1 lazy load).
     * Cụ thể: validate categoryId của câu hỏi phải khớp category của course.
     */
    @EntityGraph(attributePaths = {"course"})
    Optional<Chapter> findWithCourseById(UUID chapterId);
}
