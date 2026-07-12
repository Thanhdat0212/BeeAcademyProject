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
    }
}
