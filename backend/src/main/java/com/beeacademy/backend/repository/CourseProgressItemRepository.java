package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseProgressItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CourseProgressItemRepository extends JpaRepository<CourseProgressItem, UUID> {

    boolean existsByStudentIdAndCourseIdAndItemIdAndItemType(
            UUID studentId,
            UUID courseId,
            UUID itemId,
            String itemType
    );

    List<CourseProgressItem> findByStudentIdAndCourseId(UUID studentId, UUID courseId);

    List<CourseProgressItem> findByStudentIdAndCourseIdIn(UUID studentId, Collection<UUID> courseIds);

    long countByStudentIdAndCourseId(UUID studentId, UUID courseId);

    @Query("""
           SELECT p.courseId, COUNT(p)
           FROM CourseProgressItem p
           WHERE p.studentId = :studentId
             AND p.courseId IN :courseIds
           GROUP BY p.courseId
           """)
    List<Object[]> countCompletedByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds
    );

    @Query("""
           SELECT p.courseId, COUNT(p)
           FROM CourseProgressItem p
           WHERE p.studentId = :studentId
             AND p.courseId IN :courseIds
             AND p.itemType = 'lesson'
           GROUP BY p.courseId
           """)
    List<Object[]> countCompletedLessonsByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds
    );

    @Query("""
           SELECT p.courseId, MAX(p.completedAt)
           FROM CourseProgressItem p
           WHERE p.studentId = :studentId
             AND p.courseId IN :courseIds
           GROUP BY p.courseId
           """)
    List<Object[]> findLatestCompletedAtByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds
    );
}
