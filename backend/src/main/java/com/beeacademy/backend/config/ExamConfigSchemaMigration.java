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
public class ExamConfigSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasCoursesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'courses'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasCoursesTable)) {
            return;
        }

        log.info("Ensuring exam_configs compatibility schema exists");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_configs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
                    slot_index INTEGER NOT NULL,
                    scope_start_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
                    placement_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    duration_minutes INTEGER NOT NULL,
                    pass_score_percent INTEGER NOT NULL,
                    max_attempts INTEGER NOT NULL DEFAULT 1,
                    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
                    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
                    show_answer_after_submit BOOLEAN NOT NULL DEFAULT FALSE,
                    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    course_version_id UUID REFERENCES public.course_versions(id) ON DELETE SET NULL,
                    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_course
                ON public.exam_configs (course_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_teacher
                ON public.exam_configs (teacher_id)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS scope_start_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS placement_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS course_version_id UUID REFERENCES public.course_versions(id) ON DELETE SET NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uk_exam_configs_course_slot'
                          AND conrelid = 'public.exam_configs'::regclass
                    ) THEN
                        -- The old model had only one mutable row per course/slot, so
                        -- it cannot reliably represent a historical version. Keep
                        -- those rows as read-only legacy fallback data.
                        UPDATE public.exam_configs
                        SET course_version_id = NULL,
                            is_draft = FALSE;
                        ALTER TABLE public.exam_configs
                            DROP CONSTRAINT uk_exam_configs_course_slot;
                    END IF;
                END$$
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_version_slot
                ON public.exam_configs (course_id, course_version_id, slot_index)
                WHERE course_version_id IS NOT NULL AND is_draft = FALSE
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_draft_slot
                ON public.exam_configs (course_id, slot_index)
                WHERE is_draft = TRUE
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_legacy_slot
                ON public.exam_configs (course_id, slot_index)
                WHERE course_version_id IS NULL AND is_draft = FALSE
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_scope_start_chapter
                ON public.exam_configs (scope_start_chapter_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_placement_chapter
                ON public.exam_configs (placement_chapter_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_configs_course_version
                ON public.exam_configs (course_version_id)
                """);
        ensureUc34ExamSchema();
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_attempts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    exam_config_id UUID NOT NULL REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                    questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
                    answers JSONB,
                    score_percent NUMERIC(5,1),
                    manual_score_percent NUMERIC(5,1),
                    teacher_feedback TEXT,
                    graded_at TIMESTAMPTZ,
                    passed BOOLEAN,
                    attempt_number INTEGER NOT NULL,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    submitted_at TIMESTAMPTZ
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_attempts
                ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS exam_config_id UUID REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS answers JSONB,
                ADD COLUMN IF NOT EXISTS score_percent NUMERIC(5,1),
                ADD COLUMN IF NOT EXISTS manual_score_percent NUMERIC(5,1),
                ADD COLUMN IF NOT EXISTS teacher_feedback TEXT,
                ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS passed BOOLEAN,
                ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam
                ON public.exam_attempts (student_id, exam_config_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted_at
                ON public.exam_attempts (submitted_at)
                """);
        ensureExamIntegritySchema();
        ensureExamRetakeRequestSchema();
    }

    private void ensureUc34ExamSchema() {
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'chapter_test'
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS require_fullscreen BOOLEAN NOT NULL DEFAULT FALSE
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_configs
                ADD COLUMN IF NOT EXISTS block_copy_paste BOOLEAN NOT NULL DEFAULT FALSE
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_ai_audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    prompt_id UUID NOT NULL,
                    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
                    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
                    action TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_ai_audit_logs_teacher_created
                ON public.exam_ai_audit_logs (teacher_id, created_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_ai_audit_logs_course
                ON public.exam_ai_audit_logs (course_id)
                """);
    }

    private void ensureExamIntegritySchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_integrity_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    client_event_id UUID NOT NULL,
                    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
                    exam_id UUID NOT NULL REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
                    event_type VARCHAR(32) NOT NULL
                        CHECK (event_type IN ('TAB_HIDDEN', 'FULLSCREEN_EXIT', 'WINDOW_BLUR')),
                    violation_count INTEGER NOT NULL CHECK (violation_count > 0),
                    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uk_exam_integrity_attempt_client_event
                        UNIQUE (attempt_id, client_event_id),
                    CONSTRAINT uk_exam_integrity_attempt_count
                        UNIQUE (attempt_id, violation_count)
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_integrity_events
                ADD COLUMN IF NOT EXISTS client_event_id UUID,
                ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS event_type VARCHAR(32),
                ADD COLUMN IF NOT EXISTS violation_count INTEGER,
                ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_integrity_attempt_client_event
                ON public.exam_integrity_events(attempt_id, client_event_id)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_integrity_attempt_count
                ON public.exam_integrity_events(attempt_id, violation_count)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_integrity_enrollment_created
                ON public.exam_integrity_events(enrollment_id, occurred_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_integrity_exam_created
                ON public.exam_integrity_events(exam_id, occurred_at DESC)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_integrity_attempt_created
                ON public.exam_integrity_events(attempt_id, occurred_at DESC)
                """);
    }

    private void ensureExamRetakeRequestSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_retake_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    exam_config_id UUID NOT NULL REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                    requested_reason TEXT NOT NULL,
                    extra_attempts INTEGER,
                    decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                    decided_reason TEXT,
                    retake_expire_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    decided_at TIMESTAMPTZ
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.exam_retake_requests
                ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS exam_config_id UUID REFERENCES public.exam_configs(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                ADD COLUMN IF NOT EXISTS requested_reason TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS extra_attempts INTEGER,
                ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS approver_role VARCHAR(16),
                ADD COLUMN IF NOT EXISTS decided_reason TEXT,
                ADD COLUMN IF NOT EXISTS retake_expire_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS approval_count INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_schema = 'public'
                          AND table_name = 'exam_retake_requests'
                          AND constraint_name = 'chk_exam_retake_requests_status'
                    ) THEN
                        ALTER TABLE public.exam_retake_requests
                            ADD CONSTRAINT chk_exam_retake_requests_status
                            CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
                    END IF;
                END$$
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_retake_requests_pending
                ON public.exam_retake_requests(student_id, exam_config_id)
                WHERE status = 'PENDING'
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_retake_requests_student_exam
                ON public.exam_retake_requests(student_id, exam_config_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_retake_requests_exam_config
                ON public.exam_retake_requests(exam_config_id)
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS public.exam_retake_audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    approval_id UUID NOT NULL REFERENCES public.exam_retake_requests(id) ON DELETE CASCADE,
                    event_type VARCHAR(32) NOT NULL,
                    status_before VARCHAR(16),
                    status_after VARCHAR(16) NOT NULL,
                    actor_id UUID NOT NULL REFERENCES public.profiles(id),
                    actor_role VARCHAR(16) NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 1,
                    approval_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_retake_audit_logs_approval_created
                ON public.exam_retake_audit_logs(approval_id, created_at DESC)
                """);
    }
}
