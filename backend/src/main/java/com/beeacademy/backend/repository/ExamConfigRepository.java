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

    List<ExamConfig> findByCourseIdAndDraftTrueOrderBySlotIndexAsc(UUID courseId);

    Optional<ExamConfig> findByCourseIdAndDraftTrueAndSlotIndex(UUID courseId, Integer slotIndex);

    List<ExamConfig> findByCourseIdAndCourseVersionIdAndDraftFalseOrderBySlotIndexAsc(
            UUID courseId, UUID courseVersionId);

    Optional<ExamConfig> findByCourseIdAndCourseVersionIdAndDraftFalseAndSlotIndex(
            UUID courseId, UUID courseVersionId, Integer slotIndex);

    List<ExamConfig> findByCourseIdAndCourseVersionIdIsNullAndDraftFalseOrderBySlotIndexAsc(
            UUID courseId);

    @Query("""
           SELECT e
           FROM ExamConfig e
           LEFT JOIN FETCH e.scopeStartChapter
           LEFT JOIN FETCH e.placementChapter
           WHERE e.course.id IN :courseIds
             AND e.draft = false
           ORDER BY e.slotIndex ASC
           """)
    List<ExamConfig> findByCourseIds(@Param("courseIds") Collection<UUID> courseIds);

    Optional<ExamConfig> findByIdAndCourseId(UUID id, UUID courseId);
}
