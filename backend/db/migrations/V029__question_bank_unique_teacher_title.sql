DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'question_bank_status'
    ) THEN
        CREATE TYPE public.question_bank_status AS ENUM ('active', 'inactive');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.question_banks (
    id UUID PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    grade INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status public.question_bank_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS question_bank_id UUID
    REFERENCES public.question_banks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_banks_teacher_status
    ON public.question_banks (teacher_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_banks_teacher_category_grade
    ON public.question_banks (teacher_id, category_id, grade);

CREATE INDEX IF NOT EXISTS idx_questions_question_bank
    ON public.questions (question_bank_id);

WITH duplicates AS (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY teacher_id, lower(btrim(title))
                   ORDER BY created_at, id
               ) AS row_no
        FROM public.question_banks
    ) ranked
    WHERE row_no > 1
)
UPDATE public.question_banks qb
SET title = btrim(qb.title) || ' (' || substring(qb.id::text, 1, 8) || ')'
FROM duplicates
WHERE qb.id = duplicates.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_banks_teacher_title
    ON public.question_banks (teacher_id, lower(btrim(title)));
