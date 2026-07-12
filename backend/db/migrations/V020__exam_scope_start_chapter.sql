ALTER TABLE public.exam_configs
ADD COLUMN IF NOT EXISTS scope_start_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_configs_scope_start_chapter
ON public.exam_configs (scope_start_chapter_id);
