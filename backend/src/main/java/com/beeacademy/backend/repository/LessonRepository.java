package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code lessons}.
 *
 * <p>Lookup theo lessonId + chapterId để verify ownership:
 * GV không thể sửa lesson của chapter không thuộc khoá mình quản lý.
 */
@Repository
public interface LessonRepository extends JpaRepository<Lesson, UUID> {

    /**
     * Tìm lesson theo ID và chapterId — verify lesson thuộc đúng chapter.
     */
    Optional<Lesson> findByIdAndChapterId(UUID lessonId, UUID chapterId);

    /**
     * Load lesson kèm chapter + course để verify lesson thuộc đúng khóa học của Q&A.
     */
    @Query("""
           SELECT l
           FROM Lesson l
           JOIN FETCH l.chapter ch
           JOIN FETCH ch.course c
           WHERE l.id = :lessonId
           """)
    Optional<Lesson> findWithChapterAndCourseById(@Param("lessonId") UUID lessonId);

    /**
     * Tất cả lessons của một chapter, sắp xếp theo position ASC.
     * Dùng để tính position tiếp theo khi thêm lesson mới.
     */
    List<Lesson> findByChapterIdOrderByPositionAsc(UUID chapterId);

    /** Đếm số lessons trong một chapter — nhanh hơn load toàn bộ list. */
    int countByChapterId(UUID chapterId);

    /** Đếm tổng lessons thuộc nhiều chapter cùng lúc — dùng để refresh course counter. */
    int countByChapterIdIn(List<UUID> chapterIds);

    @Query("SELECT COUNT(l.id) FROM Lesson l WHERE l.chapter.course.id = :courseId")
    int countByCourseId(@Param("courseId") UUID courseId);

    @Query("""
           SELECT l.chapter.course.id AS courseId, COUNT(l.id) AS itemCount
           FROM Lesson l
           WHERE l.chapter.course.id IN :courseIds
           GROUP BY l.chapter.course.id
           """)
    List<CourseContentCount> countByCourseIds(@Param("courseIds") List<UUID> courseIds);
}
