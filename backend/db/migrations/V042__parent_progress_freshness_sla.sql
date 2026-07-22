ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMPTZ;

UPDATE public.enrollments
SET progress_updated_at = COALESCE(enrolled_at, NOW())
WHERE progress_updated_at IS NULL;

ALTER TABLE public.enrollments
    ALTER COLUMN progress_updated_at SET DEFAULT NOW(),
    ALTER COLUMN progress_updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_progress_updated_at
    ON public.enrollments(student_id, progress_updated_at DESC);
