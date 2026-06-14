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
