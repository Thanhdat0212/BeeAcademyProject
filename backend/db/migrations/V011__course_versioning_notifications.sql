ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
    ADD COLUMN IF NOT EXISTS version_no INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS submitted_version_no INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.course_versions (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    submitted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_course_versions_course_version UNIQUE (course_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_course_versions_course
ON public.course_versions (course_id, version_no DESC);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_path TEXT NULL,
    course_id UUID NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
ON public.admin_notifications (read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
ON public.admin_notifications (created_at DESC);
