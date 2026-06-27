package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExamConfigSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasCoursesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'courses'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasCoursesTable)) {
            return;
        }

        log.info("Ensuring exam_configs table exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_configs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
                    slot_index INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    duration_minutes INTEGER NOT NULL,
                    pass_score_percent INTEGER NOT NULL,
                    max_attempts INTEGER NOT NULL DEFAULT 1,
                    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
                    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
                    show_answer_after_submit BOOLEAN NOT NULL DEFAULT FALSE,
                    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uk_exam_configs_course_slot UNIQUE (course_id, slot_index)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_course
                ON public.exam_configs (course_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_teacher
                ON public.exam_configs (teacher_id)
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_attempts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    exam_config_id UUID NOT NULL REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                    questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
                    answers JSONB,
                    score_percent NUMERIC(5,1),
                    manual_score_percent NUMERIC(5,1),
                    teacher_feedback TEXT,
                    graded_at TIMESTAMPTZ,
                    passed BOOLEAN,
                    attempt_number INTEGER NOT NULL,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    submitted_at TIMESTAMPTZ
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_attempts
                ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS exam_config_id UUID REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS answers JSONB,
                ADD COLUMN IF NOT EXISTS score_percent NUMERIC(5,1),
                ADD COLUMN IF NOT EXISTS manual_score_percent NUMERIC(5,1),
                ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
                ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS passed BOOLEAN,
                ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam
                ON public.exam_attempts (student_id, exam_config_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted_at
                ON public.exam_attempts (submitted_at)
                """);
    }
}
