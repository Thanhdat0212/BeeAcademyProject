package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseReview;
import com.beeacademy.backend.model.CourseReviewModerationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseReviewRepository extends JpaRepository<CourseReview, UUID> {

    @EntityGraph(attributePaths = {"student"})
    List<CourseReview> findTop20ByCourse_IdOrderByUpdatedAtDesc(UUID courseId);

    @EntityGraph(attributePaths = {"student"})
    List<CourseReview> findTop20ByCourse_IdAndModerationStatusOrderByUpdatedAtDesc(
            UUID courseId, CourseReviewModerationStatus moderationStatus);

    @EntityGraph(attributePaths = {"student"})
    Optional<CourseReview> findByCourse_IdAndStudent_Id(UUID courseId, UUID studentId);

    @EntityGraph(attributePaths = {"course", "student"})
    Optional<CourseReview> findWithCourseAndStudentById(UUID reviewId);

    @EntityGraph(attributePaths = {"course", "student"})
    List<CourseReview> findTop50ByModerationStatusOrderByUpdatedAtAsc(
            CourseReviewModerationStatus moderationStatus);

    @Query("""
            SELECT r.course.id, AVG(r.rating), COUNT(r)
            FROM CourseReview r
            WHERE r.course.id IN :courseIds
              AND r.moderationStatus = :status
            GROUP BY r.course.id
            """)
    List<Object[]> summarizeByCourseIds(@Param("courseIds") List<UUID> courseIds,
                                        @Param("status") CourseReviewModerationStatus status);

    @Query("""
            SELECT AVG(r.rating), COUNT(r)
            FROM CourseReview r
            WHERE r.course.id = :courseId
              AND r.moderationStatus = :status
            """)
    Object[] summarizeByCourseId(@Param("courseId") UUID courseId,
                                  @Param("status") CourseReviewModerationStatus status);
}
