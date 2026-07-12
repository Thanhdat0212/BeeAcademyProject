ALTER TABLE public.course_reviews
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderated_by UUID;

UPDATE public.course_reviews
SET moderation_status = 'PUBLISHED'
WHERE moderation_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_course_reviews_moderation
    ON public.course_reviews (moderation_status, updated_at ASC);
