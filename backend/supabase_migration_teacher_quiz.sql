-- ============================================================================
-- Migration: Teacher Course Portal + Question Bank
-- Chạy file này trên Supabase SQL Editor TRƯỚC KHI khởi động backend
-- Thứ tự quan trọng: enums → bảng gốc → bảng phụ thuộc
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums mới
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE question_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Cập nhật bảng lessons (thêm cột mới cho teacher upload)
-- ----------------------------------------------------------------------------

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS description         TEXT,
    ADD COLUMN IF NOT EXISTS video_storage_path  TEXT,       -- path trong Supabase Storage private bucket
    ADD COLUMN IF NOT EXISTS video_embed_url     TEXT;       -- YouTube/Vimeo URL (embed)

-- Đảm bảo duration_sec có giá trị mặc định (tránh NOT NULL violation khi chưa upload video)
ALTER TABLE lessons ALTER COLUMN duration_sec SET DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. Bảng tài liệu đính kèm bài giảng
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,           -- tên hiển thị
    file_url        TEXT        NOT NULL,           -- Supabase Storage public URL
    file_type       TEXT        NOT NULL DEFAULT 'pdf',  -- pdf | pptx | docx
    file_size_bytes BIGINT      NOT NULL DEFAULT 0,
    position        INTEGER     NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_documents_lesson ON course_documents(lesson_id);

-- ----------------------------------------------------------------------------
-- 4. Bảng lịch sử duyệt khóa học
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_approval_history (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    admin_id    UUID        NOT NULL REFERENCES profiles(id),
    action      TEXT        NOT NULL CHECK (action IN ('approved', 'rejected', 'needs_revision')),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_course ON course_approval_history(course_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_created ON course_approval_history(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Bảng ngân hàng câu hỏi
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS questions (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID                NOT NULL REFERENCES profiles(id),
    category_id     UUID                REFERENCES categories(id),
    grade           INTEGER             NOT NULL DEFAULT 6,
    chapter_id      UUID                REFERENCES chapters(id),   -- null = cấp môn học
    content         TEXT                NOT NULL,
    explanation     TEXT,
    difficulty      question_difficulty NOT NULL DEFAULT 'medium',
    type            question_type       NOT NULL DEFAULT 'multiple_choice',
    tags            TEXT[]              DEFAULT '{}',
    status          question_status     NOT NULL DEFAULT 'active',
    usage_count     INTEGER             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_chapter    ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_category   ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_category_grade ON questions(category_id, grade);
CREATE INDEX IF NOT EXISTS idx_questions_teacher    ON questions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_status     ON questions(status);

-- ----------------------------------------------------------------------------
-- 6. Bảng đáp án lựa chọn
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS question_choices (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    position    INTEGER NOT NULL,
    UNIQUE(question_id, position)
);

CREATE INDEX IF NOT EXISTS idx_question_choices_question ON question_choices(question_id);

-- ----------------------------------------------------------------------------
-- 7. Bảng cấu hình quiz từng chương
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_configs (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id          UUID        NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    teacher_id          UUID        NOT NULL REFERENCES profiles(id),
    total_questions     INTEGER     NOT NULL DEFAULT 10,
    easy_count          INTEGER     NOT NULL DEFAULT 3,
    medium_count        INTEGER     NOT NULL DEFAULT 5,
    hard_count          INTEGER     NOT NULL DEFAULT 2,
    time_limit_minutes  INTEGER,                                -- null = không giới hạn
    passing_score       NUMERIC(4,1) NOT NULL DEFAULT 6.0,
    shuffle_questions   BOOLEAN     NOT NULL DEFAULT TRUE,
    shuffle_choices     BOOLEAN     NOT NULL DEFAULT TRUE,
    max_attempts        INTEGER,                                -- null = không giới hạn
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chapter_id)                                         -- 1 chương = 1 config
);

-- ----------------------------------------------------------------------------
-- 8. Bảng lượt làm quiz của học sinh
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID        NOT NULL REFERENCES profiles(id),
    quiz_config_id      UUID        NOT NULL REFERENCES quiz_configs(id),
    questions_snapshot  JSONB       NOT NULL,   -- câu hỏi + đáp án đúng lúc bắt đầu làm
    answers             JSONB,                  -- {questionId: choiceId} lúc nộp bài
    score               NUMERIC(4,1),           -- null nếu chưa nộp
    passed              BOOLEAN,
    attempt_number      INTEGER     NOT NULL DEFAULT 1,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_config  ON quiz_attempts(quiz_config_id);

-- ----------------------------------------------------------------------------
-- 9. Tạo Supabase Storage buckets (chạy riêng nếu cần qua Supabase Dashboard)
-- Lệnh SQL dưới chỉ ghi nhận — bucket phải tạo qua Dashboard hoặc API
-- ----------------------------------------------------------------------------

-- Bucket: course-videos (PRIVATE — video bài học, cần signed URL khi xem)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-videos', 'course-videos', false)
-- ON CONFLICT (id) DO NOTHING;

-- Bucket: course-docs (PUBLIC — PDF, slide)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-docs', 'course-docs', true)
-- ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Kiểm tra kết quả
-- ----------------------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('course_documents','course_approval_history','questions',
                     'question_choices','quiz_configs','quiz_attempts')
ORDER BY table_name;
