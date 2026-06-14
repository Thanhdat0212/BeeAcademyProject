-- ============================================================================
-- Migration: Revenue Splits + Payout Periods
-- Chạy file này trên Supabase SQL Editor
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kỳ thanh toán (thường = 1 tháng)
CREATE TABLE IF NOT EXISTS payout_periods (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month_year      VARCHAR(20)  NOT NULL,   -- "2026-05" (YYYY-MM để sort được)
    status          payout_status NOT NULL DEFAULT 'pending',
    paid_at         TIMESTAMPTZ,
    paid_by_admin   UUID         REFERENCES profiles(id),
    transfer_ref    VARCHAR(100),
    transfer_content TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_payout_periods_teacher_id ON payout_periods(teacher_id);
CREATE INDEX IF NOT EXISTS idx_payout_periods_status     ON payout_periods(status);

-- Mỗi giao dịch bán khóa học — 1 row = 1 HS mua 1 khóa
CREATE TABLE IF NOT EXISTS revenue_splits (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id          UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id          UUID         NOT NULL REFERENCES profiles(id),
    course_id           UUID         NOT NULL REFERENCES courses(id),
    order_id            UUID         NOT NULL REFERENCES orders(id),
    order_item_id       UUID         NOT NULL REFERENCES order_items(id),
    gross_vnd           INTEGER      NOT NULL DEFAULT 0,
    platform_fee_vnd    INTEGER      NOT NULL DEFAULT 0,
    teacher_amount_vnd  INTEGER      NOT NULL DEFAULT 0,
    platform_fee_pct    NUMERIC      NOT NULL DEFAULT 30,
    period              TEXT         NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM'),
    payout_period_id    UUID         REFERENCES payout_periods(id),
    gross_amount        INTEGER      NOT NULL,   -- giá HS đã trả (VND)
    platform_fee        INTEGER      NOT NULL,   -- phần nền tảng giữ
    teacher_amount      INTEGER      NOT NULL,   -- phần GV nhận
    teacher_percent     INTEGER      NOT NULL DEFAULT 70,
    occurred_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Đảm bảo tất cả cột tồn tại kể cả khi bảng được tạo từ schema cũ.
-- ADD COLUMN IF NOT EXISTS là idempotent — an toàn khi chạy lại nhiều lần.
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS student_id       UUID REFERENCES profiles(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS course_id        UUID REFERENCES courses(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS order_id         UUID REFERENCES orders(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS order_item_id    UUID REFERENCES order_items(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS gross_vnd        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS platform_fee_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS teacher_amount_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS platform_fee_pct NUMERIC NOT NULL DEFAULT 30;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS period           TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM');
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS payout_period_id UUID REFERENCES payout_periods(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS gross_amount     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS platform_fee     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS teacher_amount   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS teacher_percent  INTEGER NOT NULL DEFAULT 70;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE revenue_splits ALTER COLUMN gross_vnd SET DEFAULT 0;
ALTER TABLE revenue_splits ALTER COLUMN platform_fee_vnd SET DEFAULT 0;
ALTER TABLE revenue_splits ALTER COLUMN teacher_amount_vnd SET DEFAULT 0;
ALTER TABLE revenue_splits ALTER COLUMN platform_fee_pct SET DEFAULT 30;
ALTER TABLE revenue_splits ALTER COLUMN period SET DEFAULT to_char(NOW(), 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_revenue_splits_teacher_id       ON revenue_splits(teacher_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_payout_period_id ON revenue_splits(payout_period_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_order_id         ON revenue_splits(order_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_order_item_id    ON revenue_splits(order_item_id);
