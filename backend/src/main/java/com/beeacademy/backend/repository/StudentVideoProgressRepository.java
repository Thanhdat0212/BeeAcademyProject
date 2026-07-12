package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.StudentVideoProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface StudentVideoProgressRepository extends JpaRepository<StudentVideoProgress, UUID> {

    Optional<StudentVideoProgress> findByStudent_IdAndLesson_Id(UUID studentId, UUID lessonId);

    Optional<StudentVideoProgress> findFirstByStudent_IdAndLesson_Chapter_Course_IdOrderByUpdatedAtDesc(
            UUID studentId,
            UUID courseId
    );

    @Query("""
           SELECT p.lesson.chapter.course.id, MAX(p.updatedAt)
           FROM StudentVideoProgress p
           WHERE p.student.id = :studentId
             AND p.lesson.chapter.course.id IN :courseIds
           GROUP BY p.lesson.chapter.course.id
           """)
    List<Object[]> findLatestUpdatedAtByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds
    );
}
