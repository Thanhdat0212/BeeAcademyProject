ALTER TABLE public.course_versions
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

UPDATE public.course_versions cv
SET approved_at = COALESCE(c.published_at, cv.submitted_at)
FROM public.courses c
WHERE cv.course_id = c.id
  AND c.status::text = 'published'
  AND cv.version_no = c.submitted_version_no
  AND cv.approved_at IS NULL;

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS course_version_id UUID;

UPDATE public.enrollments e
SET course_version_id = (
    SELECT cv.id
    FROM public.course_versions cv
    WHERE cv.course_id = e.course_id
      AND cv.approved_at IS NOT NULL
    ORDER BY
      CASE WHEN cv.approved_at <= e.enrolled_at THEN 0 ELSE 1 END,
      CASE WHEN cv.approved_at <= e.enrolled_at THEN cv.approved_at END DESC,
      cv.version_no ASC
    LIMIT 1
)
WHERE e.course_version_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_enrollments_course_version'
    ) THEN
        ALTER TABLE public.enrollments
            ADD CONSTRAINT fk_enrollments_course_version
            FOREIGN KEY (course_version_id)
            REFERENCES public.course_versions(id)
            ON DELETE RESTRICT;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_enrollments_course_version
    ON public.enrollments(course_version_id);

CREATE TABLE IF NOT EXISTS public.course_version_migration_logs (
    id UUID PRIMARY KEY,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    from_version_id UUID NOT NULL REFERENCES public.course_versions(id) ON DELETE RESTRICT,
    to_version_id UUID NOT NULL REFERENCES public.course_versions(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason VARCHAR(1000) NOT NULL,
    progress_mapping JSONB NOT NULL,
    final_exam_mapping JSONB NOT NULL,
    certificate_mapping VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_course_version_migration_different
        CHECK (from_version_id <> to_version_id)
);

CREATE INDEX IF NOT EXISTS idx_course_version_migrations_enrollment_created
    ON public.course_version_migration_logs(enrollment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_version_migrations_course_created
    ON public.course_version_migration_logs(course_id, created_at DESC);
