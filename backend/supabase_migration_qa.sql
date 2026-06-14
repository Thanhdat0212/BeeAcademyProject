-- Q&A giữa học sinh và giáo viên.
-- Chạy trên Supabase SQL Editor trước khi dùng các endpoint /api/student/qa và /api/teacher/qa.
-- Idempotent: có thể chạy lại nhiều lần mà không lỗi.

CREATE TABLE IF NOT EXISTS qa_threads (
    id               UUID        PRIMARY KEY,
    student_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id        UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id        UUID        NULL REFERENCES lessons(id) ON DELETE SET NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patch bảng đã tồn tại thiếu cột (chạy lại an toàn)
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS status           VARCHAR(20)  NOT NULL DEFAULT 'pending';
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ  NULL;
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS lesson_id        UUID         NULL REFERENCES lessons(id) ON DELETE SET NULL;

-- CHECK constraint (bỏ qua nếu đã có)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'qa_threads' AND constraint_name = 'chk_qa_threads_status'
    ) THEN
        ALTER TABLE qa_threads
            ADD CONSTRAINT chk_qa_threads_status
            CHECK (status IN ('pending', 'answered', 'resolved'));
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_qa_threads_student_id  ON qa_threads(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_course_id   ON qa_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_status      ON qa_threads(status);
CREATE INDEX IF NOT EXISTS idx_qa_threads_last_activity ON qa_threads(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS qa_messages (
    id          UUID        PRIMARY KEY,
    thread_id   UUID        NOT NULL REFERENCES qa_threads(id) ON DELETE CASCADE,
    author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_role user_role   NOT NULL,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_messages_thread_id  ON qa_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_qa_messages_created_at ON qa_messages(created_at ASC);
