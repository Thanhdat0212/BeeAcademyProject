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
public class EnrollmentSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasEnrollmentsTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'enrollments'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasEnrollmentsTable)) {
            return;
        }

        log.info("Ensuring enrollments table uses student_id column");
        jdbcTemplate.execute("""
                ALTER TABLE public.enrollments
                ADD COLUMN IF NOT EXISTS student_id UUID
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'enrollments'
                          AND column_name = 'user_id'
                    ) THEN
                        UPDATE public.enrollments
                        SET student_id = user_id
                        WHERE student_id IS NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_enrollments_student_id
                ON public.enrollments (student_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_enrollments_student_course
                ON public.enrollments (student_id, course_id)
                """);
    }
}
