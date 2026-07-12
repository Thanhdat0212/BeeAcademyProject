-- V029: Bảo đảm schema bài tập tự luận (UC16) tồn tại đầy đủ.
-- Bảng assignments/assignment_submissions trước đây được tạo tay trên Supabase,
-- chưa có trong migrations — file này chuẩn hóa lại, an toàn chạy nhiều lần.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
        CREATE TYPE submission_status AS ENUM ('submitted', 'graded', 'returned');
    END IF;
END $$;

ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'submitted';

CREATE TABLE IF NOT EXISTS assignments (
    id          UUID PRIMARY KEY,
    lesson_id   UUID REFERENCES lessons(id) ON DELETE CASCADE,
    chapter_id  UUID REFERENCES chapters(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    max_score   INTEGER NOT NULL DEFAULT 10 CHECK (max_score > 0),
    due_at      TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (lesson_id IS NOT NULL OR chapter_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id            UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content       TEXT,
    file_urls     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status        submission_status NOT NULL DEFAULT 'submitted',
    score         INTEGER,
    feedback      TEXT,
    graded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    graded_at     TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_chapter
    ON assignments (chapter_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson
    ON assignments (lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
    ON assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status
    ON assignment_submissions (status);
