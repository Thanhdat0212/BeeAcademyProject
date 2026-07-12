ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS objective TEXT,
    ADD COLUMN IF NOT EXISTS audience TEXT;
