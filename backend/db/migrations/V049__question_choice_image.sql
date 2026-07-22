ALTER TABLE public.question_choices
    ADD COLUMN IF NOT EXISTS image_url TEXT;
