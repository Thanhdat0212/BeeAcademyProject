CREATE TABLE IF NOT EXISTS student_reward_balances (
    student_id       UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    available_points INTEGER     NOT NULL DEFAULT 0 CHECK (available_points >= 0),
    lifetime_points  INTEGER     NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_reward_sources (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assessment_type    TEXT        NOT NULL CHECK (assessment_type IN ('QUIZ', 'EXAM')),
    assessment_id      UUID        NOT NULL,
    best_score_percent NUMERIC(5,1) NOT NULL DEFAULT 0,
    awarded_points     INTEGER     NOT NULL DEFAULT 0 CHECK (awarded_points >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, assessment_type, assessment_id)
);

CREATE TABLE IF NOT EXISTS reward_vouchers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT        NOT NULL UNIQUE,
    display_name    TEXT        NOT NULL,
    required_points INTEGER     NOT NULL CHECK (required_points > 0),
    discount_amount INTEGER     NOT NULL CHECK (discount_amount > 0),
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_reward_vouchers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    voucher_id  UUID        NOT NULL REFERENCES reward_vouchers(id),
    status      TEXT        NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE', 'RESERVED', 'USED')),
    order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at     TIMESTAMPTZ
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER,
ADD COLUMN IF NOT EXISTS reward_discount_amount INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_voucher_id UUID REFERENCES student_reward_vouchers(id) ON DELETE SET NULL;

UPDATE orders
SET subtotal_amount = total_amount
WHERE subtotal_amount IS NULL;

ALTER TABLE orders
ALTER COLUMN subtotal_amount SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_sources_student
    ON student_reward_sources(student_id);

CREATE INDEX IF NOT EXISTS idx_student_reward_vouchers_student_status
    ON student_reward_vouchers(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_reward_vouchers_order
    ON student_reward_vouchers(order_id);

INSERT INTO reward_vouchers (code, display_name, required_points, discount_amount, sort_order)
VALUES
    ('BRONZE_30K', 'Bronze 30K', 100, 30000, 1),
    ('SILVER_70K', 'Silver 70K', 200, 70000, 2),
    ('GOLD_150K', 'Gold 150K', 400, 150000, 3)
ON CONFLICT (code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    required_points = EXCLUDED.required_points,
    discount_amount = EXCLUDED.discount_amount,
    sort_order = EXCLUDED.sort_order,
    active = TRUE;
