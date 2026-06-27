CREATE TABLE IF NOT EXISTS public.parent_link_audit_log (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(80) NOT NULL,
    old_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parent_link_audit_log_parent_student
    ON public.parent_link_audit_log (parent_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parent_link_audit_log_actor
    ON public.parent_link_audit_log (actor_id, created_at DESC);
