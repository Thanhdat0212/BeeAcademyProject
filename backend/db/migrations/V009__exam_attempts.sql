CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_config_id UUID NOT NULL REFERENCES public.exam_configs(id) ON DELETE CASCADE,
    questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    answers JSONB,
    score_percent NUMERIC(5,1),
    passed BOOLEAN,
    attempt_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ
);

ALTER TABLE public.exam_attempts
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS exam_config_id UUID REFERENCES public.exam_configs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS questions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS answers JSONB,
ADD COLUMN IF NOT EXISTS score_percent NUMERIC(5,1),
ADD COLUMN IF NOT EXISTS passed BOOLEAN,
ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam
ON public.exam_attempts (student_id, exam_config_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted_at
ON public.exam_attempts (submitted_at);

-- Chặn race condition: học sinh không thể tạo 2 attempt cùng số thứ tự
-- cho cùng 1 bài kiểm tra ngay cả khi mở 2 tab đồng thời.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_attempt_number
ON public.exam_attempts (student_id, exam_config_id, attempt_number);
