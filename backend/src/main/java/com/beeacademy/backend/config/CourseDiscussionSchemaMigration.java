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
public class CourseDiscussionSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasProfilesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasProfilesTable)) {
            return;
        }

        log.info("Ensuring course discussion schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_discussion_threads (
                    id UUID PRIMARY KEY,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
                    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_course
                ON public.course_discussion_threads (course_id, last_activity_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_lesson
                ON public.course_discussion_threads (lesson_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_author
                ON public.course_discussion_threads (author_id)
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_discussion_replies (
                    id UUID PRIMARY KEY,
                    thread_id UUID NOT NULL REFERENCES public.course_discussion_threads(id) ON DELETE CASCADE,
                    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_thread
                ON public.course_discussion_replies (thread_id, created_at ASC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_author
                ON public.course_discussion_replies (author_id)
                """);
    }
}
