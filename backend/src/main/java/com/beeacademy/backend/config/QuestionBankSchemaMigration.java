package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent compatibility migration for question-bank grade scope.
 *
 * <p>The project keeps Hibernate ddl-auto disabled, and the SQL files under
 * {@code backend/db/migrations} are not executed automatically by Spring Boot.
 * This runner keeps existing dev/Supabase databases from breaking after the
 * {@code questions.grade} column was introduced.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionBankSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasQuestionsTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'questions'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasQuestionsTable)) {
            return;
        }

        Boolean hasGradeColumn = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'questions'
                      AND column_name = 'grade'
                )
                """, Boolean.class);

        if (Boolean.TRUE.equals(hasGradeColumn)) {
            return;
        }

        log.info("Applying compatibility migration: add questions.grade");
        jdbcTemplate.execute("ALTER TABLE public.questions ADD COLUMN grade INTEGER");
        jdbcTemplate.execute("""
                UPDATE public.questions q
                SET grade = COALESCE(
                    (
                        SELECT c.grades[1]
                        FROM public.chapters ch
                        JOIN public.courses c ON c.id = ch.course_id
                        WHERE ch.id = q.chapter_id
                    ),
                    6
                )
                WHERE q.grade IS NULL
                """);
        jdbcTemplate.execute("ALTER TABLE public.questions ALTER COLUMN grade SET NOT NULL");
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_questions_teacher_category_grade_status
                ON public.questions (teacher_id, category_id, grade, status)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_questions_category_grade_difficulty_active
                ON public.questions (category_id, grade, difficulty)
                WHERE status = 'active'
                """);
    }
}
