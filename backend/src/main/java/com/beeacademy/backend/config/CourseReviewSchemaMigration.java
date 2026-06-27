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
public class CourseReviewSchemaMigration implements ApplicationRunner {

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

        log.info("Ensuring course review schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_reviews (
                    id UUID PRIMARY KEY,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    comment TEXT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_course_reviews_course_student UNIQUE (course_id, student_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_reviews_course_updated
                ON public.course_reviews (course_id, updated_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_reviews_student
                ON public.course_reviews (student_id)
                """);
    }
}
