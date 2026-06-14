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
