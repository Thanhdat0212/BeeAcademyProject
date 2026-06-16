package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Chapter;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChapterRepository extends JpaRepository<Chapter, UUID> {

    Optional<Chapter> findByIdAndCourseId(UUID chapterId, UUID courseId);

    List<Chapter> findByCourseIdOrderByPositionAsc(UUID courseId);

    int countByCourseId(UUID courseId);

    @EntityGraph(attributePaths = "lessons")
    List<Chapter> findWithLessonsByCourseId(UUID courseId);

    @EntityGraph(attributePaths = {"course"})
    Optional<Chapter> findWithCourseById(UUID chapterId);
}
