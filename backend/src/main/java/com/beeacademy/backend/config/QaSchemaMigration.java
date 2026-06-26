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
public class QaSchemaMigration implements ApplicationRunner {

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

        log.info("Ensuring QA schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.qa_threads (
                    id UUID PRIMARY KEY,
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    resolved_at TIMESTAMPTZ NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_threads
                ADD COLUMN IF NOT EXISTS lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_threads
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_threads
                ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_threads
                ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_threads
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND column_name = 'title'
                    ) THEN
                        ALTER TABLE public.qa_threads
                            ALTER COLUMN title DROP NOT NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND column_name = 'content'
                    ) THEN
                        ALTER TABLE public.qa_threads
                            ALTER COLUMN content DROP NOT NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND column_name = 'body'
                    ) THEN
                        ALTER TABLE public.qa_threads
                            ALTER COLUMN body DROP NOT NULL;
                    END IF;
                END$$
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND constraint_name = 'chk_qa_threads_status'
                    ) THEN
                        ALTER TABLE public.qa_threads
                            ADD CONSTRAINT chk_qa_threads_status
                            CHECK (status IN ('pending', 'answered', 'resolved'));
                    END IF;
                END$$
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_threads_student_id
                ON public.qa_threads (student_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_threads_course_id
                ON public.qa_threads (course_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_threads_status
                ON public.qa_threads (status)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_threads_last_activity
                ON public.qa_threads (last_activity_at DESC)
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.qa_messages (
                    id UUID PRIMARY KEY,
                    thread_id UUID NOT NULL REFERENCES public.qa_threads(id) ON DELETE CASCADE,
                    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    author_role user_role NOT NULL,
                    content TEXT NOT NULL,
                    attachment_url TEXT NULL,
                    attachment_name VARCHAR(255) NULL,
                    attachment_type VARCHAR(100) NULL,
                    attachment_size_bytes BIGINT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.qa_messages
                    ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL,
                    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL,
                    ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100) NULL,
                    ADD COLUMN IF NOT EXISTS attachment_size_bytes BIGINT NULL
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_messages_thread_id
                ON public.qa_messages (thread_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_qa_messages_created_at
                ON public.qa_messages (created_at ASC)
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND column_name = 'content'
                    ) THEN
                        INSERT INTO public.qa_messages (id, thread_id, author_id, author_role, content, created_at)
                        SELECT gen_random_uuid(), t.id, t.student_id, 'student'::user_role, t.content, t.created_at
                        FROM public.qa_threads t
                        WHERE t.content IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM public.qa_messages m WHERE m.thread_id = t.id
                          );
                    END IF;
                END$$
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'qa_threads'
                          AND column_name = 'body'
                    ) THEN
                        INSERT INTO public.qa_messages (id, thread_id, author_id, author_role, content, created_at)
                        SELECT gen_random_uuid(), t.id, t.student_id, 'student'::user_role, t.body, t.created_at
                        FROM public.qa_threads t
                        WHERE t.body IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM public.qa_messages m WHERE m.thread_id = t.id
                          );
                    END IF;
                END$$
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.user_notifications (
                    id UUID PRIMARY KEY,
                    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    type VARCHAR(80) NOT NULL,
                    title VARCHAR(180) NOT NULL,
                    body TEXT NOT NULL,
                    target_url VARCHAR(500) NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    read_at TIMESTAMPTZ NULL
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created
                ON public.user_notifications (recipient_id, created_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
                ON public.user_notifications (recipient_id, created_at DESC)
                WHERE read_at IS NULL
                """);
    }
}
