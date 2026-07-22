package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(200)
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
        jdbcTemplate.execute("""
                ALTER TABLE public.enrollments
                ADD COLUMN IF NOT EXISTS progress_pct INTEGER,
                ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                UPDATE public.enrollments
                SET progress_pct = COALESCE(progress_pct, 0),
                    progress_updated_at = COALESCE(progress_updated_at, enrolled_at, NOW())
                WHERE progress_pct IS NULL OR progress_updated_at IS NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.enrollments
                ALTER COLUMN progress_pct SET DEFAULT 0,
                ALTER COLUMN progress_updated_at SET DEFAULT NOW(),
                ALTER COLUMN progress_updated_at SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.enrollments
                ADD COLUMN IF NOT EXISTS course_version_id UUID
                """);
        jdbcTemplate.execute("""
                UPDATE public.enrollments e
                SET course_version_id = (
                    SELECT cv.id
                    FROM public.course_versions cv
                    WHERE cv.course_id = e.course_id
                      AND cv.approved_at IS NOT NULL
                    ORDER BY
                      CASE WHEN cv.approved_at <= e.enrolled_at THEN 0 ELSE 1 END,
                      CASE WHEN cv.approved_at <= e.enrolled_at THEN cv.approved_at END DESC,
                      cv.version_no ASC
                    LIMIT 1
                )
                WHERE e.course_version_id IS NULL
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_enrollments_course_version'
                    ) THEN
                        ALTER TABLE public.enrollments
                            ADD CONSTRAINT fk_enrollments_course_version
                            FOREIGN KEY (course_version_id)
                            REFERENCES public.course_versions(id)
                            ON DELETE RESTRICT;
                    END IF;
                END $$
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_enrollments_course_version
                ON public.enrollments (course_version_id)
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.course_version_migration_logs (
                    id UUID PRIMARY KEY,
                    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
                    from_version_id UUID NOT NULL REFERENCES public.course_versions(id) ON DELETE RESTRICT,
                    to_version_id UUID NOT NULL REFERENCES public.course_versions(id) ON DELETE RESTRICT,
                    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
                    reason VARCHAR(1000) NOT NULL,
                    progress_mapping JSONB NOT NULL,
                    final_exam_mapping JSONB NOT NULL,
                    certificate_mapping VARCHAR(1000) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT chk_course_version_migration_different
                        CHECK (from_version_id <> to_version_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_version_migrations_enrollment_created
                ON public.course_version_migration_logs (enrollment_id, created_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_course_version_migrations_course_created
                ON public.course_version_migration_logs (course_id, created_at DESC)
                """);
    }
}
