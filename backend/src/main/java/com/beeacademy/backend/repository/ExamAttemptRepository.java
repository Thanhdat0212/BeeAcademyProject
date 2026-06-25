package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, UUID> {

    int countByStudentIdAndExamConfigId(UUID studentId, UUID examConfigId);

    Optional<ExamAttempt> findByIdAndStudentId(UUID id, UUID studentId);

    Optional<ExamAttempt> findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(
            UUID studentId, UUID examConfigId);

    @Query("""
            SELECT attempt
            FROM ExamAttempt attempt
            JOIN FETCH attempt.examConfig config
            JOIN FETCH config.course course
            WHERE attempt.student.id = :studentId
              AND course.id IN :courseIds
              AND attempt.submittedAt IS NOT NULL
            ORDER BY attempt.submittedAt DESC
            """)
    List<ExamAttempt> findSubmittedByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds);

    @Query("""
            SELECT attempt
            FROM ExamAttempt attempt
            JOIN FETCH attempt.student
            JOIN FETCH attempt.examConfig config
            JOIN FETCH config.course
            WHERE config.teacher.id = :teacherId
              AND attempt.submittedAt IS NOT NULL
            ORDER BY attempt.submittedAt DESC
            """)
    List<ExamAttempt> findSubmittedAttemptsForTeacher(@Param("teacherId") UUID teacherId);

    @Query("""
            SELECT attempt
            FROM ExamAttempt attempt
            JOIN FETCH attempt.student
            JOIN FETCH attempt.examConfig config
            JOIN FETCH config.course
            WHERE attempt.id = :attemptId
              AND config.teacher.id = :teacherId
              AND attempt.submittedAt IS NOT NULL
            """)
    Optional<ExamAttempt> findSubmittedAttemptForTeacher(
            @Param("attemptId") UUID attemptId,
            @Param("teacherId") UUID teacherId);
}
