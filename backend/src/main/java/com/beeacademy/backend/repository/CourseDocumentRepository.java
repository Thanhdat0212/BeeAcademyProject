package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Truy vấn bảng {@code course_documents}.
 * Dùng để load danh sách tài liệu đính kèm của một bài giảng.
 */
@Repository
public interface CourseDocumentRepository extends JpaRepository<CourseDocument, UUID> {

    /** Lấy tất cả tài liệu của một bài giảng, sắp xếp theo position. */
    List<CourseDocument> findByLessonIdOrderByPositionAsc(UUID lessonId);

    /** Đếm số tài liệu của một bài giảng (để tính position cho cái mới). */
    int countByLessonId(UUID lessonId);

    /** Lấy tất cả tài liệu của nhiều bài giảng — dùng khi build course detail. */
    @org.springframework.data.jpa.repository.Query(
        "SELECT d FROM CourseDocument d WHERE d.lesson.id IN :lessonIds ORDER BY d.position ASC")
    List<CourseDocument> findByLessonIdIn(@org.springframework.data.repository.query.Param("lessonIds")
                                           List<UUID> lessonIds);
}
