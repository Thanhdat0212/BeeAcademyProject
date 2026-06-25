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
public class ParentLinkSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'parent_student_links'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasTable)) {
            return;
        }

        log.info("Ensuring parent_student_links invitation columns exist");
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    CREATE TYPE public.parent_link_status AS ENUM ('pending', 'active', 'revoked');
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.parent_student_links
                    ADD COLUMN IF NOT EXISTS status public.parent_link_status,
                    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.parent_student_links
                    ALTER COLUMN status DROP DEFAULT
                """);
        jdbcTemplate.execute("""
                DO $$
                DECLARE current_status_type TEXT;
                BEGIN
                    SELECT c.udt_name
                    INTO current_status_type
                    FROM information_schema.columns c
                    WHERE c.table_schema = 'public'
                      AND c.table_name = 'parent_student_links'
                      AND c.column_name = 'status';

                    IF current_status_type IS DISTINCT FROM 'parent_link_status' THEN
                        ALTER TABLE public.parent_student_links
                            ALTER COLUMN status TYPE public.parent_link_status
                            USING CASE LOWER(COALESCE(status::text, 'active'))
                                WHEN 'pending' THEN 'pending'::public.parent_link_status
                                WHEN 'accepted' THEN 'active'::public.parent_link_status
                                WHEN 'active' THEN 'active'::public.parent_link_status
                                WHEN 'rejected' THEN 'revoked'::public.parent_link_status
                                WHEN 'revoked' THEN 'revoked'::public.parent_link_status
                                ELSE 'active'::public.parent_link_status
                            END;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                UPDATE public.parent_student_links
                SET status = 'active'::public.parent_link_status
                WHERE status IS NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.parent_student_links
                    ALTER COLUMN status SET DEFAULT 'active'::public.parent_link_status,
                    ALTER COLUMN status SET NOT NULL
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent_status
                ON public.parent_student_links (parent_id, status, invited_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_parent_student_links_student_status
                ON public.parent_student_links (student_id, status, invited_at DESC)
                """);
    }
}
