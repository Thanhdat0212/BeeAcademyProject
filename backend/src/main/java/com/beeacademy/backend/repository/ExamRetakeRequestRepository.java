package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamRetakeRequest;
import com.beeacademy.backend.model.ExamRetakeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExamRetakeRequestRepository extends JpaRepository<ExamRetakeRequest, UUID> {

    Optional<ExamRetakeRequest> findFirstByStudentIdAndExamConfigIdOrderByCreatedAtDesc(
            UUID studentId, UUID examConfigId);

    boolean existsByStudentIdAndExamConfigIdAndStatus(
            UUID studentId, UUID examConfigId, ExamRetakeStatus status);

    List<ExamRetakeRequest> findByStudentIdAndExamConfigIdAndStatus(
            UUID studentId, UUID examConfigId, ExamRetakeStatus status);

    List<ExamRetakeRequest> findByExamConfigCourseTeacherIdAndStatusOrderByCreatedAtAsc(
            UUID teacherId, ExamRetakeStatus status);

    List<ExamRetakeRequest> findByStatusOrderByCreatedAtAsc(ExamRetakeStatus status);
}
