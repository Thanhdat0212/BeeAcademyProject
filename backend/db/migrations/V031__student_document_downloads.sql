ALTER TABLE public.course_documents
    ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE TABLE IF NOT EXISTS public.student_document_downloads (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.course_documents(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    temporary_storage_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_document_downloads_rate
    ON public.student_document_downloads(student_id, document_id, downloaded_at DESC);
