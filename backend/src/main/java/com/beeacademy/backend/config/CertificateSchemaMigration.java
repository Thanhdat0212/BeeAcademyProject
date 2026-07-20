package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(300)
@RequiredArgsConstructor
public class CertificateSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasCertificatesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'certificates'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasCertificatesTable)) {
            return;
        }

        log.info("Ensuring certificates table matches the current certificate model");
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'exam_attempt_id'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'final_exam_attempt_id'
                    ) THEN
                        ALTER TABLE public.certificates
                            RENAME COLUMN exam_attempt_id TO final_exam_attempt_id;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'certificate_code'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'certificate_no'
                    ) THEN
                        ALTER TABLE public.certificates
                            RENAME COLUMN certificate_code TO certificate_no;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'pdf_url'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'certificates'
                          AND column_name = 'pdf_storage_path'
                    ) THEN
                        ALTER TABLE public.certificates
                            RENAME COLUMN pdf_url TO pdf_storage_path;
                    END IF;
                END $$
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.certificates
                ADD COLUMN IF NOT EXISTS final_exam_attempt_id UUID
                    REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(24),
                ADD COLUMN IF NOT EXISTS certificate_no VARCHAR(40),
                ADD COLUMN IF NOT EXISTS verification_code VARCHAR(80),
                ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
                ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS version_no INTEGER,
                ADD COLUMN IF NOT EXISTS review_note TEXT,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                UPDATE public.certificates
                SET status = CASE
                        WHEN status IN ('NOT_ISSUED', 'ISSUED', 'NEEDS_REVIEW', 'REISSUED', 'REVOKED')
                            THEN status
                        WHEN issued_at IS NULL THEN 'NOT_ISSUED'
                        ELSE 'ISSUED'
                    END,
                    certificate_no = COALESCE(
                        NULLIF(BTRIM(certificate_no), ''),
                        'BEE-CERT-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 31))
                    ),
                    verification_code = COALESCE(
                        NULLIF(BTRIM(verification_code), ''),
                        REPLACE(gen_random_uuid()::text, '-', '')
                    ),
                    version_no = COALESCE(version_no, CASE WHEN issued_at IS NULL THEN 0 ELSE 1 END),
                    created_at = COALESCE(created_at, issued_at, NOW()),
                    updated_at = COALESCE(updated_at, issued_at, created_at, NOW())
                WHERE status IS NULL
                   OR status NOT IN ('NOT_ISSUED', 'ISSUED', 'NEEDS_REVIEW', 'REISSUED', 'REVOKED')
                   OR certificate_no IS NULL
                   OR BTRIM(certificate_no) = ''
                   OR verification_code IS NULL
                   OR BTRIM(verification_code) = ''
                   OR version_no IS NULL
                   OR created_at IS NULL
                   OR updated_at IS NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.certificates
                ALTER COLUMN issued_at DROP NOT NULL,
                ALTER COLUMN issued_at DROP DEFAULT,
                ALTER COLUMN status SET DEFAULT 'NOT_ISSUED',
                ALTER COLUMN status SET NOT NULL,
                ALTER COLUMN certificate_no SET NOT NULL,
                ALTER COLUMN verification_code SET NOT NULL,
                ALTER COLUMN version_no SET DEFAULT 0,
                ALTER COLUMN version_no SET NOT NULL,
                ALTER COLUMN created_at SET DEFAULT NOW(),
                ALTER COLUMN created_at SET NOT NULL,
                ALTER COLUMN updated_at SET DEFAULT NOW(),
                ALTER COLUMN updated_at SET NOT NULL
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'chk_certificates_status'
                          AND conrelid = 'public.certificates'::regclass
                    ) THEN
                        ALTER TABLE public.certificates
                            ADD CONSTRAINT chk_certificates_status
                            CHECK (status IN (
                                'NOT_ISSUED', 'ISSUED', 'NEEDS_REVIEW', 'REISSUED', 'REVOKED'
                            ));
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'chk_certificates_version_no'
                          AND conrelid = 'public.certificates'::regclass
                    ) THEN
                        ALTER TABLE public.certificates
                            ADD CONSTRAINT chk_certificates_version_no
                            CHECK (version_no >= 0);
                    END IF;
                END $$
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_certificates_student_course
                ON public.certificates(student_id, course_id)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_certificates_no
                ON public.certificates(certificate_no)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_certificates_verification
                ON public.certificates(verification_code)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_certificates_student
                ON public.certificates(student_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_certificates_course
                ON public.certificates(course_id)
                """);
    }
}
