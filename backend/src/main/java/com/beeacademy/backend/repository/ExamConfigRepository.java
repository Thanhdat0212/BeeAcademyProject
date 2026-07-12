package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamConfigRepository extends JpaRepository<ExamConfig, UUID> {

    List<ExamConfig> findByCourseIdOrderBySlotIndexAsc(UUID courseId);

    @Query("""
           SELECT e
           FROM ExamConfig e
           LEFT JOIN FETCH e.scopeStartChapter
           LEFT JOIN FETCH e.placementChapter
           WHERE e.course.id IN :courseIds
           ORDER BY e.slotIndex ASC
           """)
    List<ExamConfig> findByCourseIds(@Param("courseIds") Collection<UUID> courseIds);

    @Query("""
           SELECT e
           FROM ExamConfig e
           LEFT JOIN FETCH e.course
           LEFT JOIN FETCH e.scopeStartChapter
           LEFT JOIN FETCH e.placementChapter
           WHERE e.course.id = :courseId
           ORDER BY e.slotIndex ASC
           """)
    List<ExamConfig> findStudentVisibleByCourseId(@Param("courseId") UUID courseId);

    @Query("""
           SELECT e
           FROM ExamConfig e
           LEFT JOIN FETCH e.course
           LEFT JOIN FETCH e.scopeStartChapter
           LEFT JOIN FETCH e.placementChapter
           WHERE e.course.id = :courseId
             AND e.slotIndex = :slotIndex
           """)
    Optional<ExamConfig> findStudentVisibleByCourseIdAndSlotIndex(
            @Param("courseId") UUID courseId,
            @Param("slotIndex") Integer slotIndex);

    Optional<ExamConfig> findByCourseIdAndSlotIndex(UUID courseId, Integer slotIndex);

    Optional<ExamConfig> findByIdAndCourseId(UUID id, UUID courseId);
}
