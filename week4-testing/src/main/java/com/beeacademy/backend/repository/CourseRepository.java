package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseRepository extends JpaRepository<Course, UUID>,
                                          JpaSpecificationExecutor<Course> {

    Optional<Course> findBySlug(String slug);

    @EntityGraph(attributePaths = {"category", "teacher"})
    Optional<Course> findWithCategoryAndTeacherById(UUID id);

    @EntityGraph(attributePaths = {"category", "teacher"})
    Optional<Course> findWithCategoryAndTeacherBySlug(String slug);

    @Query(value = "SELECT c FROM Course c JOIN FETCH c.category JOIN FETCH c.teacher WHERE c.status = :status",
           countQuery = "SELECT COUNT(c) FROM Course c WHERE c.status = :status")
    Page<Course> findPendingReview(@Param("status") CourseStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"category", "teacher"})
    @Query("SELECT c FROM Course c WHERE c.id IN " +
           "(SELECT e.courseId FROM Enrollment e WHERE e.studentId = :studentId) " +
           "ORDER BY c.createdAt DESC")
    List<Course> findEnrolledByStudentId(@Param("studentId") UUID studentId);

    @EntityGraph(attributePaths = {"teacher"})
    @Query("SELECT c FROM Course c WHERE c.teacher.id = :teacherId")
    List<Course> findByTeacherId(@Param("teacherId") UUID teacherId);

    @Modifying(flushAutomatically = true)
    @Query("UPDATE Course c SET c.totalChapters = :chapterCount, c.totalLessons = :lessonCount WHERE c.id = :courseId")
    void updateCounts(@Param("courseId") UUID courseId,
                      @Param("chapterCount") int chapterCount,
                      @Param("lessonCount") int lessonCount);

    @Query("SELECT c.id, c.title, t.fullName, cat.name, COUNT(e) " +
           "FROM Course c LEFT JOIN c.teacher t LEFT JOIN c.category cat, Enrollment e " +
           "WHERE e.courseId = c.id AND c.status = :status " +
           "GROUP BY c.id, c.title, t.fullName, cat.name " +
           "ORDER BY COUNT(e) DESC")
    List<Object[]> findTopByEnrollments(@Param("status") CourseStatus status, Pageable pageable);
}
