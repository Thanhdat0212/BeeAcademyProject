package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ExamAttempt;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    int countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(UUID studentId, UUID examConfigId);

    Optional<ExamAttempt> findByIdAndStudentId(UUID id, UUID studentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT attempt FROM ExamAttempt attempt WHERE attempt.id = :attemptId")
    Optional<ExamAttempt> findByIdForUpdate(@Param("attemptId") UUID attemptId);

    Optional<ExamAttempt> findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNullOrderByStartedAtDesc(
            UUID studentId, UUID examConfigId);

    Optional<ExamAttempt> findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(
            UUID studentId, UUID examConfigId);

    Optional<ExamAttempt> findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
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
            JOIN FETCH attempt.examConfig config
            JOIN FETCH config.course course
            WHERE attempt.student.id = :studentId
              AND course.id IN :courseIds
            ORDER BY COALESCE(attempt.submittedAt, attempt.startedAt) DESC
            """)
    List<ExamAttempt> findByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds);

    @Query("""
           SELECT config.course.id, MAX(COALESCE(attempt.submittedAt, attempt.startedAt))
           FROM ExamAttempt attempt
           JOIN attempt.examConfig config
           WHERE attempt.student.id = :studentId
             AND config.course.id IN :courseIds
           GROUP BY config.course.id
           """)
    List<Object[]> findLatestActivityByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds);

    @Query("""
           SELECT DISTINCT config.course.id
           FROM ExamAttempt attempt
           JOIN attempt.examConfig config
           WHERE attempt.student.id = :studentId
             AND config.course.id IN :courseIds
             AND config.slotIndex = :finalSlotIndex
             AND attempt.submittedAt IS NOT NULL
             AND attempt.passed = true
           """)
    List<UUID> findPassedFinalCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds,
            @Param("finalSlotIndex") Integer finalSlotIndex);

    /**
     * Courses for which the student has at least one submitted, passing attempt
     * in every fixed exam slot (0, 1, 2 and 3).
     *
     * <p>{@code COUNT(DISTINCT ...)} prevents repeated passing attempts in one
     * slot from being mistaken for completion of multiple required exams.
     */
    @Query("""
           SELECT config.course.id
           FROM ExamAttempt attempt
           JOIN attempt.examConfig config
           WHERE attempt.student.id = :studentId
             AND config.course.id IN :courseIds
             AND config.slotIndex IN (0, 1, 2, 3)
             AND attempt.submittedAt IS NOT NULL
             AND attempt.passed = true
           GROUP BY config.course.id
           HAVING COUNT(DISTINCT config.slotIndex) = 4
           """)
    List<UUID> findCourseIdsWithAllRequiredExamsPassed(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds);

    @Query("""
           SELECT DISTINCT config.id
           FROM ExamAttempt attempt
           JOIN attempt.examConfig config
           WHERE attempt.student.id = :studentId
             AND config.id IN :examConfigIds
             AND attempt.submittedAt IS NOT NULL
             AND attempt.passed = true
           """)
    List<UUID> findPassedRequiredExamConfigIds(
            @Param("studentId") UUID studentId,
            @Param("examConfigIds") Collection<UUID> examConfigIds);

    @Query("""
           SELECT attempt
           FROM ExamAttempt attempt
           JOIN FETCH attempt.examConfig config
           WHERE attempt.student.id = :studentId
             AND config.id = :examConfigId
             AND attempt.submittedAt IS NOT NULL
             AND attempt.passed = true
           ORDER BY COALESCE(attempt.manualScorePercent, attempt.scorePercent) DESC,
                    attempt.submittedAt DESC
           """)
    List<ExamAttempt> findPassedAttemptsForConfig(
            @Param("studentId") UUID studentId,
            @Param("examConfigId") UUID examConfigId);

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

    @Query("""
            SELECT attempt
            FROM ExamAttempt attempt
            JOIN FETCH attempt.student
            JOIN FETCH attempt.examConfig config
            JOIN FETCH config.course course
            WHERE attempt.student.id = :studentId
              AND course.id = :courseId
              AND config.slotIndex = :slotIndex
              AND attempt.submittedAt IS NOT NULL
              AND attempt.passed = true
            ORDER BY COALESCE(attempt.manualScorePercent, attempt.scorePercent) DESC,
                     attempt.submittedAt DESC
            """)
    List<ExamAttempt> findPassedFinalAttempts(
            @Param("studentId") UUID studentId,
            @Param("courseId") UUID courseId,
            @Param("slotIndex") Integer slotIndex);
}
