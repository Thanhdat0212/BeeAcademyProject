ALTER TABLE public.question_versions
    ADD COLUMN IF NOT EXISTS question_bank_id UUID,
    ADD COLUMN IF NOT EXISTS category_id UUID,
    ADD COLUMN IF NOT EXISTS grade INTEGER,
    ADD COLUMN IF NOT EXISTS chapter_id UUID,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16);

UPDATE public.question_versions qv
SET question_bank_id = q.question_bank_id,
    category_id = q.category_id,
    grade = q.grade,
    chapter_id = q.chapter_id,
    status = q.status::text
FROM public.questions q
WHERE q.id = qv.question_id
  AND (qv.category_id IS NULL OR qv.grade IS NULL OR qv.status IS NULL);

CREATE TABLE IF NOT EXISTS public.question_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    question_id UUID NOT NULL,
    old_version INTEGER,
    new_version INTEGER,
    action VARCHAR(16) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_question_audit_action
        CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE')),
    CONSTRAINT chk_question_audit_old_version
        CHECK (old_version IS NULL OR old_version > 0),
    CONSTRAINT chk_question_audit_new_version
        CHECK (new_version IS NULL OR new_version > 0),
    CONSTRAINT chk_question_audit_version_transition
        CHECK (
            (action = 'CREATE' AND old_version IS NULL AND new_version IS NOT NULL)
            OR (action IN ('UPDATE', 'ARCHIVE') AND old_version IS NOT NULL AND new_version IS NOT NULL AND new_version > old_version)
            OR (action = 'DELETE' AND old_version IS NOT NULL AND new_version IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_question_audit_question_created
    ON public.question_audit_logs(question_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_audit_teacher_created
    ON public.question_audit_logs(teacher_id, created_at DESC);
