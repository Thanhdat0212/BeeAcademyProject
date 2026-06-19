CREATE TABLE IF NOT EXISTS course_discussion_threads (
    id               UUID        PRIMARY KEY,
    course_id        UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id        UUID        NULL REFERENCES lessons(id) ON DELETE SET NULL,
    author_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content          TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_course
    ON course_discussion_threads(course_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_lesson
    ON course_discussion_threads(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_discussion_threads_author
    ON course_discussion_threads(author_id);

CREATE TABLE IF NOT EXISTS course_discussion_replies (
    id         UUID        PRIMARY KEY,
    thread_id  UUID        NOT NULL REFERENCES course_discussion_threads(id) ON DELETE CASCADE,
    author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_thread
    ON course_discussion_replies(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_course_discussion_replies_author
    ON course_discussion_replies(author_id);
