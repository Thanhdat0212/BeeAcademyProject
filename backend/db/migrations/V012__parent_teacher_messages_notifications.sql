ALTER TABLE public.qa_messages
    ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS attachment_size_bytes BIGINT NULL;

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    target_url VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created
    ON public.user_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
    ON public.user_notifications (recipient_id, created_at DESC)
    WHERE read_at IS NULL;
