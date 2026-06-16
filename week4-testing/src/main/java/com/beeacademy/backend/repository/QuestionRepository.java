package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID>,
                                             JpaSpecificationExecutor<Question> {

    @Query(value = "SELECT q FROM Question q " +
                   "LEFT JOIN FETCH q.category LEFT JOIN FETCH q.chapter " +
                   "WHERE q.teacher.id = :teacherId AND q.status = :status",
           countQuery = "SELECT COUNT(q) FROM Question q " +
                        "WHERE q.teacher.id = :teacherId AND q.status = :status")
    Page<Question> findByTeacherIdAndStatus(
            @Param("teacherId") UUID teacherId,
            @Param("status") String status,
            Pageable pageable);

    @Query("SELECT DISTINCT q FROM Question q LEFT JOIN FETCH q.choices " +
           "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
           "AND q.difficulty = :difficulty AND q.status = 'active'")
    List<Question> findActiveByTeacherAndChapterAndDifficulty(
            @Param("teacherId") UUID teacherId,
            @Param("chapterId") UUID chapterId,
            @Param("difficulty") String difficulty);

    @Query("SELECT DISTINCT q FROM Question q LEFT JOIN FETCH q.choices " +
           "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId AND q.status = 'active'")
    List<Question> findActiveByTeacherAndChapter(
            @Param("teacherId") UUID teacherId,
            @Param("chapterId") UUID chapterId);

    @Query("SELECT q.difficulty, COUNT(q) FROM Question q " +
           "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
           "AND q.status = 'active' GROUP BY q.difficulty")
    List<Object[]> countActiveByDifficultyForTeacherAndChapter(
            @Param("teacherId") UUID teacherId,
            @Param("chapterId") UUID chapterId);

    @Modifying
    @Query("UPDATE Question q SET q.usageCount = q.usageCount + 1 WHERE q.id IN :ids")
    void incrementUsageCount(@Param("ids") List<UUID> ids);
}
