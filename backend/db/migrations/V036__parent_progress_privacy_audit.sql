ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS parent_privacy_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.parent_student_links
    ADD COLUMN IF NOT EXISTS sensitive_data_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sensitive_data_consent_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.parent_progress_access_audit (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action VARCHAR(80) NOT NULL,
    sensitive_data_requested BOOLEAN NOT NULL,
    sensitive_data_allowed BOOLEAN NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_progress_access_audit_parent_student
    ON public.parent_progress_access_audit (parent_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_progress_access_audit_created
    ON public.parent_progress_access_audit (created_at DESC);
