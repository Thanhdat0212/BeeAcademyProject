-- UC15: Tách tài liệu học tập khỏi bucket public và cưỡng chế one-time download.
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-documents', 'course-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE public.course_documents
    ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
ALTER TABLE public.course_documents
    ALTER COLUMN file_url DROP NOT NULL;

-- Bản ghi cũ vẫn trỏ course-docs; backend di trú từng lô rồi xóa object public sau commit.
UPDATE public.course_documents
SET storage_bucket = 'course-docs'
WHERE storage_bucket IS NULL;

ALTER TABLE public.student_document_downloads
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_document_downloads_token_hash
    ON public.student_document_downloads(token_hash)
    WHERE token_hash IS NOT NULL;
