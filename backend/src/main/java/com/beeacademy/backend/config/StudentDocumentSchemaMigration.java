package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Runtime fallback cho UC15 khi database chua chay Flyway migration. */
@Component
@RequiredArgsConstructor
public class StudentDocumentSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("ALTER TABLE public.course_documents ADD COLUMN IF NOT EXISTS storage_path TEXT");
        jdbcTemplate.execute("ALTER TABLE public.course_documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT");
        jdbcTemplate.execute("ALTER TABLE public.course_documents ALTER COLUMN file_url DROP NOT NULL");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.student_document_downloads (
                    id UUID PRIMARY KEY,
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    document_id UUID NOT NULL REFERENCES public.course_documents(id) ON DELETE CASCADE,
                    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    temporary_storage_path TEXT,
                    token_hash TEXT,
                    consumed_at TIMESTAMPTZ
                )
                """);
        jdbcTemplate.execute("ALTER TABLE public.student_document_downloads ADD COLUMN IF NOT EXISTS token_hash TEXT");
        jdbcTemplate.execute("ALTER TABLE public.student_document_downloads ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ");
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_student_document_downloads_rate
                ON public.student_document_downloads(student_id, document_id, downloaded_at DESC)
                """);
        jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_student_document_downloads_token_hash " +
                "ON public.student_document_downloads(token_hash) WHERE token_hash IS NOT NULL");
    }
}
