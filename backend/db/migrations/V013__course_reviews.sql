CREATE TABLE IF NOT EXISTS public.course_reviews (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_reviews_course_student UNIQUE (course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_updated
    ON public.course_reviews (course_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_reviews_student
    ON public.course_reviews (student_id);
