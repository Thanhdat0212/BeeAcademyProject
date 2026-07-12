CREATE TABLE IF NOT EXISTS course_progress_items (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id    UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    item_id      UUID        NOT NULL,
    item_type    TEXT        NOT NULL CHECK (item_type IN ('lesson', 'quiz')),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_id, item_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_student_course
    ON course_progress_items(student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_course_progress_course
    ON course_progress_items(course_id);
