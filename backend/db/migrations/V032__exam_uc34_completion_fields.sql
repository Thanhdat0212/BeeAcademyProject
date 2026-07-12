ALTER TABLE public.exam_configs
    ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'chapter_test';

ALTER TABLE public.exam_configs
    ADD COLUMN IF NOT EXISTS require_fullscreen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.exam_configs
    ADD COLUMN IF NOT EXISTS block_copy_paste BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.exam_ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    prompt TEXT NOT NULL,
    source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_ai_audit_logs_teacher_created
    ON public.exam_ai_audit_logs (teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_ai_audit_logs_course
    ON public.exam_ai_audit_logs (course_id);
