-- UC17: server-side audit for every tab/fullscreen integrity violation.
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
);

CREATE INDEX IF NOT EXISTS idx_exam_integrity_enrollment_created
    ON public.exam_integrity_events(enrollment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_integrity_exam_created
    ON public.exam_integrity_events(exam_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_integrity_attempt_created
    ON public.exam_integrity_events(attempt_id, occurred_at DESC);
