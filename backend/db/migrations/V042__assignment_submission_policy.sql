-- UC16: deadline enforcement, late policy, configurable attempt limit and closure state.
-- Defaults preserve existing assignments while making the SRS policy explicit/testable.

ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS late_penalty_percent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accepting_submissions BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE assignment_submissions
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS late BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS late_penalty_percent INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS raw_score INTEGER,
    ADD COLUMN IF NOT EXISTS expected_graded_by TIMESTAMPTZ;

UPDATE assignment_submissions
SET expected_graded_by = submitted_at + INTERVAL '7 days'
WHERE expected_graded_by IS NULL;

ALTER TABLE assignment_submissions
    ALTER COLUMN expected_graded_by SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_assignments_max_attempts'
    ) THEN
        ALTER TABLE assignments
            ADD CONSTRAINT ck_assignments_max_attempts CHECK (max_attempts >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_assignments_late_penalty'
    ) THEN
        ALTER TABLE assignments
            ADD CONSTRAINT ck_assignments_late_penalty
            CHECK (late_penalty_percent BETWEEN 0 AND 100);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_assignment_submissions_attempt'
    ) THEN
        ALTER TABLE assignment_submissions
            ADD CONSTRAINT ck_assignment_submissions_attempt CHECK (attempt_number >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_assignment_submissions_late_penalty'
    ) THEN
        ALTER TABLE assignment_submissions
            ADD CONSTRAINT ck_assignment_submissions_late_penalty
            CHECK (late_penalty_percent BETWEEN 0 AND 100);
    END IF;
END $$;
