package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QuestionBank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuestionBankRepository extends JpaRepository<QuestionBank, UUID> {

    Optional<QuestionBank> findByIdAndTeacherId(UUID id, UUID teacherId);

    @Query("""
            SELECT COUNT(qb) > 0
            FROM QuestionBank qb
            WHERE qb.teacher.id = :teacherId
              AND (:excludeId IS NULL OR qb.id <> :excludeId)
              AND LOWER(TRIM(qb.title)) = LOWER(TRIM(:title))
            """)
    boolean existsByTeacherIdAndTitleIgnoreCase(@Param("teacherId") UUID teacherId,
                                                @Param("title") String title,
                                                @Param("excludeId") UUID excludeId);

    default boolean existsByTeacherIdAndTitleIgnoreCase(UUID teacherId, String title) {
        return existsByTeacherIdAndTitleIgnoreCase(teacherId, title, null);
    }

    @Query("""
            SELECT qb.id AS id,
                   qb.title AS title,
                   qb.description AS description,
                   qb.status AS status,
                   c.id AS categoryId,
                   c.name AS categoryName,
                   qb.grade AS grade,
                   COUNT(q.id) AS questionCount,
                   qb.createdAt AS createdAt,
                   qb.updatedAt AS updatedAt
            FROM QuestionBank qb
            JOIN qb.category c
            LEFT JOIN Question q ON q.questionBank.id = qb.id
            WHERE qb.teacher.id = :teacherId
            GROUP BY qb.id, qb.title, qb.description, qb.status, c.id, c.name,
                     qb.grade, qb.createdAt, qb.updatedAt
            ORDER BY qb.createdAt DESC
            """)
    List<QuestionBankSummaryView> findSummariesByTeacherId(@Param("teacherId") UUID teacherId);

    interface QuestionBankSummaryView {
        UUID getId();
        String getTitle();
        String getDescription();
        String getStatus();
        UUID getCategoryId();
        String getCategoryName();
        Integer getGrade();
        Long getQuestionCount();
        Instant getCreatedAt();
        Instant getUpdatedAt();
    }
}
