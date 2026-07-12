package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Assignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {

    @Query("""
            SELECT DISTINCT assignment
            FROM Assignment assignment
            LEFT JOIN FETCH assignment.chapter chapter
            LEFT JOIN FETCH assignment.lesson lesson
            LEFT JOIN FETCH lesson.chapter lessonChapter
            WHERE chapter.course.id = :courseId
               OR lessonChapter.course.id = :courseId
            ORDER BY assignment.createdAt ASC
            """)
    List<Assignment> findAllByCourseId(@Param("courseId") UUID courseId);

    @Query("""
            SELECT DISTINCT assignment
            FROM Assignment assignment
            LEFT JOIN FETCH assignment.chapter chapter
            LEFT JOIN FETCH assignment.lesson lesson
            LEFT JOIN FETCH lesson.chapter lessonChapter
            WHERE chapter.course.teacher.id = :teacherId
               OR lessonChapter.course.teacher.id = :teacherId
            ORDER BY assignment.createdAt DESC
            """)
    List<Assignment> findAllByTeacherId(@Param("teacherId") UUID teacherId);

    @Query("""
            SELECT assignment
            FROM Assignment assignment
            LEFT JOIN FETCH assignment.chapter chapter
            LEFT JOIN FETCH assignment.lesson lesson
            LEFT JOIN FETCH lesson.chapter lessonChapter
            WHERE assignment.id = :assignmentId
            """)
    Optional<Assignment> findWithCourseById(@Param("assignmentId") UUID assignmentId);
}
