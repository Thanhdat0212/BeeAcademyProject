CREATE TABLE IF NOT EXISTS public.exam_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
    slot_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    pass_score_percent INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
    show_answer_after_submit BOOLEAN NOT NULL DEFAULT FALSE,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_exam_configs_course_slot UNIQUE (course_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_exam_configs_course
ON public.exam_configs (course_id);

CREATE INDEX IF NOT EXISTS idx_exam_configs_teacher
ON public.exam_configs (teacher_id);
