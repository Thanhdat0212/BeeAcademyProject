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
    }
}
