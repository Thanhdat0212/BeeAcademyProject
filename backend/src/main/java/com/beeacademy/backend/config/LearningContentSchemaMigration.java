package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Bổ sung metadata phục vụ UC14 cho dữ liệu lesson đã tồn tại. */
@Component
@RequiredArgsConstructor
public class LearningContentSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean lessonsExist = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'lessons'
                )
                """, Boolean.class);
        if (!Boolean.TRUE.equals(lessonsExist)) return;

        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS completion_rule VARCHAR(32)");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS transcript TEXT");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS subtitle_url TEXT");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS slide_cue_seconds TEXT");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_fallback_url TEXT");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS hls_playlist_url TEXT");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_processing_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED'");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_uploaded_at TIMESTAMPTZ");
        jdbcTemplate.execute("ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS original_video_retention_until TIMESTAMPTZ");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_content_audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    entity_type VARCHAR(32) NOT NULL,
                    entity_id UUID,
                    action VARCHAR(32) NOT NULL,
                    change_type VARCHAR(16) NOT NULL,
                    actor_id UUID NOT NULL REFERENCES public.profiles(id),
                    before_state JSONB,
                    after_state JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_content_audit_logs_course_created
                ON public.course_content_audit_logs(course_id, created_at DESC)
                """);
    }
}
