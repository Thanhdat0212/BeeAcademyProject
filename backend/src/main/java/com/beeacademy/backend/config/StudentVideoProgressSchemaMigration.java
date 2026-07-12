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
public class StudentVideoProgressSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean ready = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'lessons'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                )
                """, Boolean.class);
        if (!Boolean.TRUE.equals(ready)) return;

        log.info("Ensuring private student video progress schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.student_video_progress (
                    id UUID PRIMARY KEY,
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
                    position_sec INTEGER NOT NULL DEFAULT 0 CHECK (position_sec >= 0),
                    duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (duration_sec >= 0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_student_video_progress_student_lesson UNIQUE (student_id, lesson_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_student_video_progress_student_updated
                ON public.student_video_progress (student_id, updated_at DESC)
                """);
        jdbcTemplate.execute("ALTER TABLE public.student_video_progress ENABLE ROW LEVEL SECURITY");
        jdbcTemplate.execute("ALTER TABLE public.student_video_progress ADD COLUMN IF NOT EXISTS watched_segments JSONB NOT NULL DEFAULT '[]'::jsonb");
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE schemaname = 'public'
                          AND tablename = 'student_video_progress'
                          AND policyname = 'student_video_progress_owner_only'
                    ) THEN
                        CREATE POLICY student_video_progress_owner_only
                            ON public.student_video_progress
                            FOR ALL
                            USING (student_id = auth.uid())
                            WITH CHECK (student_id = auth.uid());
                    END IF;
                END
                $$
                """);
    }
}
