CREATE TABLE IF NOT EXISTS question_versions (
    id UUID PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id),
    version_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    explanation TEXT,
    metadata_json JSONB,
    difficulty TEXT NOT NULL,
    type TEXT NOT NULL,
    choices_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    change_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_question_versions_question_version UNIQUE (question_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_question_versions_question
    ON question_versions(question_id, version_no DESC);

CREATE TABLE IF NOT EXISTS grade_audit_logs (
    id UUID PRIMARY KEY,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES profiles(id),
    grader_id UUID NOT NULL REFERENCES profiles(id),
    old_score DOUBLE PRECISION,
    new_score DOUBLE PRECISION NOT NULL,
    reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grade_audit_logs_target
    ON grade_audit_logs(target_type, target_id, created_at DESC);

ALTER TABLE qa_messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

ALTER TABLE qa_threads
    ADD COLUMN IF NOT EXISTS duplicate_of_thread_id UUID REFERENCES qa_threads(id),
    ADD COLUMN IF NOT EXISTS duplicate_marked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_qa_threads_duplicate_of
    ON qa_threads(duplicate_of_thread_id);

ALTER TABLE payout_periods
    ADD COLUMN IF NOT EXISTS unc_attachment_url VARCHAR(1000);

CREATE INDEX IF NOT EXISTS idx_payout_periods_teacher_status_month
    ON payout_periods(teacher_id, status, month_year DESC);
