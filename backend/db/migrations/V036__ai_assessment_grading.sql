-- UC AI chấm sơ bộ: học sinh nhờ AI chấm/nhận xét trước khi giáo viên chấm chính thức.
-- exam_attempts: lưu điểm sơ bộ AI + nhận xét có cấu trúc (JSONB) để HS xem lại và GV tham khảo khi chấm.
-- quiz_attempts: chỉ lưu nhận xét (quiz đã chấm tự động, AI không đưa điểm).

ALTER TABLE public.exam_attempts
    ADD COLUMN IF NOT EXISTS ai_score_percent NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS ai_feedback JSONB,
    ADD COLUMN IF NOT EXISTS ai_graded_at TIMESTAMPTZ;

ALTER TABLE public.quiz_attempts
    ADD COLUMN IF NOT EXISTS ai_feedback JSONB,
    ADD COLUMN IF NOT EXISTS ai_graded_at TIMESTAMPTZ;
