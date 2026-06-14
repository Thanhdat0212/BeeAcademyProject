-- ============================================================================
-- Migration: Thêm cột PayOS vào bảng orders
-- Chạy file này trên Supabase SQL Editor
-- ============================================================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_code  BIGINT UNIQUE,
    ADD COLUMN IF NOT EXISTS payment_link_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
