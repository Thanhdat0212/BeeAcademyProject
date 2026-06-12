package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamConfigRepository extends JpaRepository<ExamConfig, UUID> {

    List<ExamConfig> findByCourseIdOrderBySlotIndexAsc(UUID courseId);

    Optional<ExamConfig> findByCourseIdAndSlotIndex(UUID courseId, Integer slotIndex);
}
