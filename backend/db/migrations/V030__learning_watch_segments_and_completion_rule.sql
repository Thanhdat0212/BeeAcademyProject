ALTER TABLE public.student_video_progress
    ADD COLUMN IF NOT EXISTS watched_segments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS completion_rule VARCHAR(32),
    ADD COLUMN IF NOT EXISTS transcript TEXT,
    ADD COLUMN IF NOT EXISTS subtitle_url TEXT;
