-- File đính kèm (ảnh/PDF evidence) cho từng tin nhắn trong thread khiếu nại.
--
-- Lưu trên bucket PRIVATE `complaint-attachments` (chỉ lưu storage_path, backend
-- sinh signed URL TTL 1h khi đọc — giống pattern video bài giảng). Mỗi tin nhắn
-- tối đa 5 file, ảnh jpeg/png/webp hoặc PDF, ≤ 5MB/file (validate ở service).

CREATE TABLE IF NOT EXISTS public.complaint_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.complaint_messages(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_attachments_message_id
    ON public.complaint_attachments(message_id);

-- Bucket private chứa file đính kèm khiếu nại (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-attachments', 'complaint-attachments', false)
ON CONFLICT (id) DO NOTHING;
