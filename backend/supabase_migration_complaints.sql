-- Khiếu nại (UC11 + UC38): HS/PH/GV gửi khiếu nại → Admin xử lý dạng thread.
-- Chạy trên Supabase SQL Editor trước khi dùng /api/complaints và /api/admin/complaints.
-- Idempotent: có thể chạy lại nhiều lần mà không lỗi.

CREATE TABLE IF NOT EXISTS complaints (
    id               UUID        PRIMARY KEY,
    sender_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_role      user_role   NOT NULL,
    title            VARCHAR(200) NOT NULL,
    category         VARCHAR(30) NOT NULL DEFAULT 'other',
    priority         VARCHAR(10) NOT NULL DEFAULT 'medium',
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patch bảng complaints nếu đã tồn tại nhưng thiếu cột (chạy lại an toàn)
-- Tự động bổ sung các cột còn thiếu của thiết kế mới vào bảng cũ nếu bảng đã tồn tại.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sender_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sender_role      user_role   NOT NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS title            VARCHAR(200) NOT NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS category         VARCHAR(30) NOT NULL DEFAULT 'other';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS priority         VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS status           VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- CHECK constraints (bỏ qua nếu đã có)
DO $$
BEGIN
    -- 1. Đồng bộ kiểu dữ liệu cột status về VARCHAR(20) và chuyển các giá trị hiện tại về chữ thường.
    -- Điều này giúp khắc phục triệt để lỗi khi cột status đang sử dụng kiểu enum complaint_status
    -- hoặc chứa các giá trị viết hoa, đồng thời khớp với thiết kế của Spring Boot (dùng String/VARCHAR).
    ALTER TABLE complaints ALTER COLUMN status TYPE VARCHAR(20) USING LOWER(status::text);
    ALTER TABLE complaints ALTER COLUMN status SET DEFAULT 'pending';

    -- 2. Thêm ràng buộc CHECK cho status nếu chưa tồn tại
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'complaints' AND constraint_name = 'chk_complaints_status'
    ) THEN
        ALTER TABLE complaints
            ADD CONSTRAINT chk_complaints_status
            CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'complaints' AND constraint_name = 'chk_complaints_priority'
    ) THEN
        ALTER TABLE complaints
            ADD CONSTRAINT chk_complaints_priority
            CHECK (priority IN ('low', 'medium', 'high'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'complaints' AND constraint_name = 'chk_complaints_category'
    ) THEN
        ALTER TABLE complaints
            ADD CONSTRAINT chk_complaints_category
            CHECK (category IN ('payment', 'course_review', 'bank_verify',
                                'student_report', 'content', 'technical', 'other'));
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_complaints_sender_id     ON complaints(sender_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status        ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_last_activity ON complaints(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS complaint_messages (
    id           UUID        PRIMARY KEY,
    complaint_id UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    author_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_role  user_role   NOT NULL,
    content      TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint_id ON complaint_messages(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_messages_created_at   ON complaint_messages(created_at ASC);
