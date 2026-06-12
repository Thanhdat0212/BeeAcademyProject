-- Q&A giữa học sinh và giáo viên.
-- Chạy trên Supabase SQL Editor trước khi dùng các endpoint /api/student/qa và /api/teacher/qa.

CREATE TABLE IF NOT EXISTS qa_threads (
    id               UUID        PRIMARY KEY,
    student_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id        UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id        UUID        NULL REFERENCES lessons(id) ON DELETE SET NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_qa_threads_status
        CHECK (status IN ('pending', 'answered', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_qa_threads_student_id ON qa_threads(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_course_id ON qa_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_status ON qa_threads(status);
CREATE INDEX IF NOT EXISTS idx_qa_threads_last_activity ON qa_threads(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS qa_messages (
    id          UUID        PRIMARY KEY,
    thread_id   UUID        NOT NULL REFERENCES qa_threads(id) ON DELETE CASCADE,
    author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_role user_role   NOT NULL,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_messages_thread_id ON qa_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_qa_messages_created_at ON qa_messages(created_at ASC);
