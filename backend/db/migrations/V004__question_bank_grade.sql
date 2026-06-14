-- Store question-bank scope by subject + grade instead of by course/chapter.
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS grade INTEGER;

UPDATE public.questions q
SET grade = COALESCE(
    (
        SELECT c.grades[1]
        FROM public.chapters ch
        JOIN public.courses c ON c.id = ch.course_id
        WHERE ch.id = q.chapter_id
    ),
    6
)
WHERE q.grade IS NULL;

ALTER TABLE public.questions
    ALTER COLUMN grade SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_teacher_category_grade_status
    ON public.questions (teacher_id, category_id, grade, status);

CREATE INDEX IF NOT EXISTS idx_questions_category_grade_difficulty_active
    ON public.questions (category_id, grade, difficulty)
    WHERE status = 'active';
