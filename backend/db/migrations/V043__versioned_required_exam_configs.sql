ALTER TABLE public.exam_configs
    ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_exam_configs_course_slot'
          AND conrelid = 'public.exam_configs'::regclass
    ) THEN
        -- Rows created by the old one-row-per-slot model are shared legacy
        -- data. Historical versions cannot be reconstructed after the row was
        -- overwritten, so keep these rows as a compatibility fallback.
        UPDATE public.exam_configs
        SET course_version_id = NULL,
            is_draft = FALSE;

        ALTER TABLE public.exam_configs
            DROP CONSTRAINT uk_exam_configs_course_slot;
    END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_version_slot
    ON public.exam_configs(course_id, course_version_id, slot_index)
    WHERE course_version_id IS NOT NULL AND is_draft = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_draft_slot
    ON public.exam_configs(course_id, slot_index)
    WHERE is_draft = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_configs_course_legacy_slot
    ON public.exam_configs(course_id, slot_index)
    WHERE course_version_id IS NULL AND is_draft = FALSE;

CREATE INDEX IF NOT EXISTS idx_exam_configs_course_version_slot
    ON public.exam_configs(course_id, course_version_id, slot_index);
