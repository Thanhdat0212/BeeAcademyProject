ALTER TYPE public.parent_link_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.parent_link_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.parent_link_status ADD VALUE IF NOT EXISTS 'revoked';

ALTER TABLE public.parent_link_audit_log
    ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.qa_messages
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(30) NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_parent_link_audit_log_actor_action_created
    ON public.parent_link_audit_log (actor_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_messages_moderation_status
    ON public.qa_messages (moderation_status, created_at DESC);
