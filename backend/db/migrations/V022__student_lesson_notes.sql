CREATE TABLE IF NOT EXISTS public.student_lesson_notes (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    time_sec INTEGER NOT NULL CHECK (time_sec >= 0),
    content VARCHAR(2000) NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_lesson_notes_owner_lesson_time
    ON public.student_lesson_notes (student_id, lesson_id, time_sec, created_at);

ALTER TABLE public.student_lesson_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'student_lesson_notes'
          AND policyname = 'student_lesson_notes_owner_only'
    ) THEN
        CREATE POLICY student_lesson_notes_owner_only
            ON public.student_lesson_notes
            FOR ALL
            USING (student_id = auth.uid())
            WITH CHECK (student_id = auth.uid());
    END IF;
END
$$;
