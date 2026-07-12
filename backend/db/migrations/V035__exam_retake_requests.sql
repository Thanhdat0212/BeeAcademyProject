-- Yêu cầu mở thêm lượt làm bài kiểm tra khi bị RETAKE_LOCKED (BRULE-RETAKE-001).
-- HS gửi yêu cầu kèm lý do → GV sở hữu khóa (hoặc Admin) duyệt/từ chối.
-- Duyệt = cộng extra_attempts (1-2) và mở lại cửa sổ làm bài đến retake_expire_at.
-- Tối đa 2 lần duyệt cho cùng (student, exam_config).

CREATE TABLE IF NOT EXISTS exam_retake_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exam_config_id UUID NOT NULL REFERENCES exam_configs(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_reason TEXT NOT NULL,
    extra_attempts INTEGER CHECK (extra_attempts BETWEEN 1 AND 2),
    decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    decided_reason TEXT,
    retake_expire_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

-- Mỗi HS chỉ có 1 yêu cầu PENDING cho mỗi bài kiểm tra.
CREATE UNIQUE INDEX IF NOT EXISTS uk_exam_retake_requests_pending
    ON exam_retake_requests(student_id, exam_config_id)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_exam_retake_requests_student_exam
    ON exam_retake_requests(student_id, exam_config_id);

CREATE INDEX IF NOT EXISTS idx_exam_retake_requests_exam_config
    ON exam_retake_requests(exam_config_id);
