package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Tạo bảng tracking lượt xem bài học thử cho UC08 nếu chưa có. */
@Slf4j
@Component
@RequiredArgsConstructor
public class CoursePreviewSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasCoursesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'courses'
                )
                """, Boolean.class);
        if (!Boolean.TRUE.equals(hasCoursesTable)) return;

        log.info("Ensuring course preview tracking schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_preview_views (
                    id UUID PRIMARY KEY,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
                    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_preview_views_course_lesson_time
                ON public.course_preview_views (course_id, lesson_id, viewed_at DESC)
                """);
    }
}
