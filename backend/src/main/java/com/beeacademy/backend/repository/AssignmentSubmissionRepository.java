package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.AssignmentSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssignmentSubmissionRepository
        extends JpaRepository<AssignmentSubmission, UUID> {

    @Query("""
            SELECT DISTINCT submission
            FROM AssignmentSubmission submission
            JOIN FETCH submission.student
            JOIN FETCH submission.assignment assignment
            LEFT JOIN FETCH assignment.chapter chapter
            LEFT JOIN FETCH assignment.lesson lesson
            LEFT JOIN FETCH lesson.chapter lessonChapter
            WHERE chapter.course.teacher.id = :teacherId
               OR lessonChapter.course.teacher.id = :teacherId
            ORDER BY submission.submittedAt DESC
            """)
    List<AssignmentSubmission> findAllForTeacher(@Param("teacherId") UUID teacherId);

    @Query("""
            SELECT DISTINCT submission
            FROM AssignmentSubmission submission
            JOIN FETCH submission.student
            JOIN FETCH submission.assignment assignment
            LEFT JOIN FETCH assignment.chapter chapter
            LEFT JOIN FETCH assignment.lesson lesson
            LEFT JOIN FETCH lesson.chapter lessonChapter
            WHERE submission.id = :submissionId
              AND (
                    chapter.course.teacher.id = :teacherId
                 OR lessonChapter.course.teacher.id = :teacherId
              )
            """)
    Optional<AssignmentSubmission> findOwned(
            @Param("submissionId") UUID submissionId,
            @Param("teacherId") UUID teacherId);
}
