ALTER TABLE public.qa_threads
    ADD COLUMN IF NOT EXISTS title VARCHAR(180) NULL;

CREATE INDEX IF NOT EXISTS idx_qa_threads_course_visibility_activity
    ON public.qa_threads (course_id, visibility, last_activity_at DESC);
