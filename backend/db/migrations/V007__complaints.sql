CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role user_role NOT NULL,
    title TEXT NOT NULL,
    category VARCHAR(40) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_complaints_priority
        CHECK (priority IN ('low', 'medium', 'high')),
    CONSTRAINT chk_complaints_status
        CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
    CONSTRAINT chk_complaints_category
        CHECK (category IN (
            'payment', 'course_review', 'bank_verify', 'student_report',
            'technical', 'other', 'course_content', 'teacher', 'grading',
            'parent_link', 'content', 'system'
        ))
);

CREATE INDEX IF NOT EXISTS idx_complaints_sender_id ON public.complaints(sender_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_last_activity ON public.complaints(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.complaint_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_role user_role NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint_id ON public.complaint_messages(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_messages_created_at ON public.complaint_messages(created_at ASC);
