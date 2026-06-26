package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QaThread;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QaThreadRepository extends JpaRepository<QaThread, UUID> {

    @EntityGraph(attributePaths = {"student", "course", "lesson", "messages", "messages.author"})
    @Query("SELECT DISTINCT t FROM QaThread t " +
           "WHERE t.student.id = :studentId " +
           "ORDER BY t.lastActivityAt DESC")
    List<QaThread> findStudentThreads(@Param("studentId") UUID studentId);

    @EntityGraph(attributePaths = {"student", "course", "lesson", "messages", "messages.author"})
    @Query("SELECT DISTINCT t FROM QaThread t " +
           "WHERE t.course.teacher.id = :teacherId " +
           "ORDER BY t.lastActivityAt DESC")
    List<QaThread> findTeacherThreads(@Param("teacherId") UUID teacherId);

    @EntityGraph(attributePaths = {
            "student", "course", "course.teacher", "course.category", "lesson", "messages", "messages.author"
    })
    @Query("SELECT DISTINCT t FROM QaThread t " +
           "WHERE t.student.id = :studentId " +
           "AND EXISTS (" +
           "    SELECT 1 FROM QaMessage m " +
           "    WHERE m.thread = t AND m.author.id = :parentId" +
           ") " +
           "ORDER BY t.lastActivityAt DESC")
    List<QaThread> findParentThreadsForStudent(@Param("parentId") UUID parentId,
                                               @Param("studentId") UUID studentId);

    @EntityGraph(attributePaths = {
            "student", "course", "course.teacher", "course.category", "lesson", "messages", "messages.author"
    })
    @Query("SELECT DISTINCT t FROM QaThread t " +
           "WHERE t.student.id = :studentId " +
           "AND t.course.id = :courseId " +
           "AND EXISTS (" +
           "    SELECT 1 FROM QaMessage m " +
           "    WHERE m.thread = t AND m.author.id = :parentId" +
           ") " +
           "ORDER BY t.lastActivityAt DESC")
    List<QaThread> findParentThreadsForCourse(@Param("parentId") UUID parentId,
                                              @Param("studentId") UUID studentId,
                                              @Param("courseId") UUID courseId);

    @EntityGraph(attributePaths = {"student", "course", "lesson", "messages", "messages.author"})
    @Query("SELECT t FROM QaThread t WHERE t.id = :id")
    Optional<QaThread> findDetailedById(@Param("id") UUID id);
}
