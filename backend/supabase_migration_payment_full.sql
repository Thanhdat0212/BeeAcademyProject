-- ============================================================================
-- Migration: Payment (VietQR + SePay) — orders + order_items
-- Chạy file này trên Supabase SQL Editor TRƯỚC KHI khởi động backend
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Xóa bảng cũ nếu có (dev environment — thứ tự quan trọng vì FK)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- ----------------------------------------------------------------------------
-- 2. Enum order_status
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. Bảng orders
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    total_amount    INTEGER      NOT NULL,
    status          order_status NOT NULL DEFAULT 'pending',
    payment_ref     VARCHAR(20)  NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    paid_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX idx_orders_user_id     ON orders(user_id);
CREATE INDEX idx_orders_payment_ref ON orders(payment_ref);
CREATE INDEX idx_orders_status      ON orders(status);

-- ----------------------------------------------------------------------------
-- 4. Bảng order_items
-- ----------------------------------------------------------------------------
CREATE TABLE order_items (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    course_id           UUID    NOT NULL REFERENCES courses(id),
    price_at_purchase   INTEGER NOT NULL
);

CREATE INDEX idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX idx_order_items_course_id ON order_items(course_id);
-- ============================================================================
-- Migration: Thêm cột PayOS vào bảng orders
-- Chạy file này trên Supabase SQL Editor
-- ============================================================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_code  BIGINT UNIQUE,
    ADD COLUMN IF NOT EXISTS payment_link_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
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
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS payout_period_id UUID REFERENCES payout_periods(id);
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS gross_amount     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS platform_fee     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS teacher_amount   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS teacher_percent  INTEGER NOT NULL DEFAULT 70;
ALTER TABLE revenue_splits ADD COLUMN IF NOT EXISTS occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_revenue_splits_teacher_id       ON revenue_splits(teacher_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_payout_period_id ON revenue_splits(payout_period_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_order_id         ON revenue_splits(order_id);
-- ============================================================================
-- Migration: Teacher Bank Accounts + Audit Log
-- Chạy file này trên Supabase SQL Editor
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE bank_verify_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS teacher_bank_accounts (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    bank_name       VARCHAR(100) NOT NULL,
    account_number  VARCHAR(30)  NOT NULL,
    account_holder  VARCHAR(150) NOT NULL,
    branch          VARCHAR(150),
    verify_status   bank_verify_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id)
);

CREATE TABLE IF NOT EXISTS teacher_bank_audit_log (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    changed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    changed_by_name VARCHAR(200),
    reason          TEXT,
    changes         JSONB        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_bank_accounts_teacher_id  ON teacher_bank_accounts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_bank_audit_log_teacher_id ON teacher_bank_audit_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_bank_audit_log_changed_at ON teacher_bank_audit_log(changed_at DESC);
