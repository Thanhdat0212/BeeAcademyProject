CREATE TABLE IF NOT EXISTS public.course_preview_views (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_preview_views_course_lesson_time
    ON public.course_preview_views (course_id, lesson_id, viewed_at DESC);
