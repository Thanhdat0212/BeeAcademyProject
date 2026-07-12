ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS slide_cue_seconds TEXT,
    ADD COLUMN IF NOT EXISTS video_fallback_url TEXT;
