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
public class CourseMetadataSchemaMigration implements ApplicationRunner {

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

        log.info("Ensuring course metadata columns exist");
        jdbcTemplate.execute("""
                ALTER TABLE public.courses
                    ADD COLUMN IF NOT EXISTS objective TEXT,
                    ADD COLUMN IF NOT EXISTS audience TEXT,
                    ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
                    ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1,
                    ADD COLUMN IF NOT EXISTS submitted_version_no INTEGER NOT NULL DEFAULT 0
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_versions (
                    id UUID PRIMARY KEY,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    version_no INTEGER NOT NULL,
                    submitted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
                    title TEXT NOT NULL,
                    snapshot JSONB NOT NULL,
                    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uk_course_versions_course_version UNIQUE (course_id, version_no)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_versions_course
                ON public.course_versions (course_id, version_no DESC)
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.admin_notifications (
                    id UUID PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    target_path TEXT NULL,
                    course_id UUID NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    actor_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
                    read_at TIMESTAMPTZ NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
                ON public.admin_notifications (read_at, created_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
                ON public.admin_notifications (created_at DESC)
                """);
    }
}
