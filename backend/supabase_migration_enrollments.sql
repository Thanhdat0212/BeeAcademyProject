-- ============================================================================
-- Migration: Bảng enrollments
-- Chạy file này trên Supabase SQL Editor (Project → SQL Editor → New query)
--
-- QUAN TRỌNG: Cột phải là student_id (KHÔNG phải user_id)
-- Entity Java dùng @Column(name = "student_id")
-- ============================================================================

-- Nếu bảng cũ tồn tại với cột user_id (schema cũ), chạy ALTER TABLE thay vì DROP:
--   ALTER TABLE enrollments RENAME COLUMN user_id TO student_id;
--   ALTER TABLE enrollments RENAME COLUMN purchased_at TO enrolled_at;
--   ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS progress_pct INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE enrollments DROP COLUMN IF EXISTS price_paid_vnd;

-- Tạo mới nếu chưa tồn tại:
CREATE TABLE IF NOT EXISTS enrollments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    course_id       UUID        NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress_pct    INTEGER     NOT NULL DEFAULT 0,
    UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON enrollments(course_id);

-- Xác nhận schema đúng (chạy SELECT để kiểm tra):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'enrollments' ORDER BY ordinal_position;
