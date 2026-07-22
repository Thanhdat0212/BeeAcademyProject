ALTER TABLE public.exam_configs
    ADD COLUMN IF NOT EXISTS course_version_id UUID REFERENCES public.course_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_configs_course_version
    ON public.exam_configs(course_version_id);

ALTER TABLE public.qa_threads
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'public';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'qa_threads'
          AND constraint_name = 'chk_qa_threads_visibility'
    ) THEN
        ALTER TABLE public.qa_threads
            ADD CONSTRAINT chk_qa_threads_visibility
            CHECK (visibility IN ('public', 'private'));
    END IF;
END$$;

ALTER TABLE public.exam_retake_requests
    ADD COLUMN IF NOT EXISTS approver_role VARCHAR(16),
    ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS approval_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

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
);

CREATE INDEX IF NOT EXISTS idx_exam_retake_audit_logs_approval_created
    ON public.exam_retake_audit_logs(approval_id, created_at DESC);

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS hls_playlist_url TEXT,
    ADD COLUMN IF NOT EXISTS video_processing_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN IF NOT EXISTS video_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS original_video_retention_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.course_content_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID,
    action VARCHAR(32) NOT NULL,
    change_type VARCHAR(16) NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(id),
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_content_audit_logs_course_created
    ON public.course_content_audit_logs(course_id, created_at DESC);
