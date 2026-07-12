package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.RewardAssessmentType;
import com.beeacademy.backend.model.StudentRewardSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentRewardSourceRepository extends JpaRepository<StudentRewardSource, UUID> {

    Optional<StudentRewardSource> findByStudentIdAndAssessmentTypeAndAssessmentId(
            UUID studentId,
            RewardAssessmentType assessmentType,
            UUID assessmentId);
}
