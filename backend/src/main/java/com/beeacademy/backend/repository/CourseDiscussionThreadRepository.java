package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseDiscussionThread;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseDiscussionThreadRepository extends JpaRepository<CourseDiscussionThread, UUID> {

    @EntityGraph(attributePaths = {"course", "lesson", "author", "replies", "replies.author"})
    @Query("SELECT DISTINCT t FROM CourseDiscussionThread t " +
           "WHERE t.course.id = :courseId " +
           "ORDER BY t.lastActivityAt DESC")
    List<CourseDiscussionThread> findByCourseIdDetailed(@Param("courseId") UUID courseId);

    @EntityGraph(attributePaths = {"course", "lesson", "author", "replies", "replies.author"})
    @Query("SELECT t FROM CourseDiscussionThread t WHERE t.id = :id")
    Optional<CourseDiscussionThread> findDetailedById(@Param("id") UUID id);
}
