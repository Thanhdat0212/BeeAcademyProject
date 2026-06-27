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
public class AssignmentSchemaMigration implements ApplicationRunner {

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

        log.info("Ensuring essay assignment indexes exist");
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_assignments_chapter
                ON public.assignments (chapter_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_assignments_lesson
                ON public.assignments (lesson_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
                ON public.assignment_submissions (assignment_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status
                ON public.assignment_submissions (status)
                """);
    }
}
