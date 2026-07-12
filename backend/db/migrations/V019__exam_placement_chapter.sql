ALTER TABLE public.exam_configs
ADD COLUMN IF NOT EXISTS placement_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_configs_placement_chapter
ON public.exam_configs (placement_chapter_id);
