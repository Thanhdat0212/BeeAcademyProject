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

        ensureQuestionTypeValues();
        ensureMetadataColumn();
        ensureGradeColumn();
        ensureQuestionBankSchema();
    }

    private void ensureQuestionTypeValues() {
        for (String type : new String[] {
                "essay",
                "essay_short",
                "essay_long",
                "fill_in_blank",
                "matching",
                "image_question",
                "formula_question",
                "audio_question",
                "file_upload"
        }) {
            jdbcTemplate.execute("""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_type t
                            JOIN pg_namespace n ON n.oid = t.typnamespace
                            WHERE n.nspname = 'public'
                              AND t.typname = 'question_type'
                        ) AND NOT EXISTS (
                            SELECT 1
                            FROM pg_enum e
                            JOIN pg_type t ON t.oid = e.enumtypid
                            JOIN pg_namespace n ON n.oid = t.typnamespace
                            WHERE n.nspname = 'public'
                              AND t.typname = 'question_type'
                              AND e.enumlabel = '%s'
                        ) THEN
                            EXECUTE 'ALTER TYPE public.question_type ADD VALUE ''%s''';
                        END IF;
                    END $$;
                    """.formatted(type, type));
        }
    }

    private void ensureMetadataColumn() {
        Boolean hasMetadataColumn = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'questions'
                      AND column_name = 'metadata_json'
                )
                """, Boolean.class);
        if (!Boolean.TRUE.equals(hasMetadataColumn)) {
            jdbcTemplate.execute("ALTER TABLE public.questions ADD COLUMN metadata_json TEXT");
        }
    }

    private void ensureGradeColumn() {
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

    private void ensureQuestionBankSchema() {
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_type t
                        JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE n.nspname = 'public'
                          AND t.typname = 'question_bank_status'
                    ) THEN
                        CREATE TYPE public.question_bank_status AS ENUM ('active', 'inactive');
                    END IF;
                END $$;
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.question_banks (
                    id UUID PRIMARY KEY,
                    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
                    category_id UUID NOT NULL REFERENCES public.categories(id),
                    grade INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    status public.question_bank_status NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);

        jdbcTemplate.execute("""
                ALTER TABLE public.questions
                ADD COLUMN IF NOT EXISTS question_bank_id UUID
                REFERENCES public.question_banks(id) ON DELETE SET NULL
                """);

        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_question_banks_teacher_status
                ON public.question_banks (teacher_id, status, created_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_question_banks_teacher_category_grade
                ON public.question_banks (teacher_id, category_id, grade)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_questions_question_bank
                ON public.questions (question_bank_id)
                """);
        jdbcTemplate.execute("""
                WITH duplicates AS (
                    SELECT id
                    FROM (
                        SELECT id,
                               ROW_NUMBER() OVER (
                                   PARTITION BY teacher_id, lower(btrim(title))
                                   ORDER BY created_at, id
                               ) AS row_no
                        FROM public.question_banks
                    ) ranked
                    WHERE row_no > 1
                )
                UPDATE public.question_banks qb
                SET title = btrim(qb.title) || ' (' || substring(qb.id::text, 1, 8) || ')'
                FROM duplicates
                WHERE qb.id = duplicates.id
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_teacher_title
                ON public.question_banks (teacher_id, lower(btrim(title)))
                """);
    }
}
