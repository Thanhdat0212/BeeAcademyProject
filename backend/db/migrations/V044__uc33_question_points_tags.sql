ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS default_points NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.question_versions
    ADD COLUMN IF NOT EXISTS default_points NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS tags_json JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.question_versions qv
SET default_points = q.default_points,
    tags_json = q.tags_json
FROM public.questions q
WHERE q.id = qv.question_id
  AND (qv.tags_json IS NULL OR qv.tags_json = '[]'::jsonb);
