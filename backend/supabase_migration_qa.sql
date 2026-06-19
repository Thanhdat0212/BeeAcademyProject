-- Q&A between students and teachers.
-- Run this in Supabase SQL Editor before using /api/student/qa and /api/teacher/qa.
-- Idempotent: safe to run more than once.

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

ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS status           VARCHAR(20)  NOT NULL DEFAULT 'pending';
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ  NULL;
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW();
ALTER TABLE qa_threads ADD COLUMN IF NOT EXISTS lesson_id        UUID         NULL REFERENCES lessons(id) ON DELETE SET NULL;

-- Legacy QA tables may still have old single-table text columns.
-- The current design stores message text in qa_messages.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_threads' AND column_name = 'title'
    ) THEN
        ALTER TABLE qa_threads ALTER COLUMN title DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_threads' AND column_name = 'content'
    ) THEN
        ALTER TABLE qa_threads ALTER COLUMN content DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_threads' AND column_name = 'body'
    ) THEN
        ALTER TABLE qa_threads ALTER COLUMN body DROP NOT NULL;
    END IF;
END$$;

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

CREATE INDEX IF NOT EXISTS idx_qa_threads_student_id    ON qa_threads(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_course_id     ON qa_threads(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_threads_status        ON qa_threads(status);
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

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_threads' AND column_name = 'content'
    ) THEN
        INSERT INTO qa_messages (id, thread_id, author_id, author_role, content, created_at)
        SELECT gen_random_uuid(), t.id, t.student_id, 'student'::user_role, t.content, t.created_at
        FROM qa_threads t
        WHERE t.content IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM qa_messages m WHERE m.thread_id = t.id
          );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'qa_threads' AND column_name = 'body'
    ) THEN
        INSERT INTO qa_messages (id, thread_id, author_id, author_role, content, created_at)
        SELECT gen_random_uuid(), t.id, t.student_id, 'student'::user_role, t.body, t.created_at
        FROM qa_threads t
        WHERE t.body IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM qa_messages m WHERE m.thread_id = t.id
          );
    END IF;
END$$;
