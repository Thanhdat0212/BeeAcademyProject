CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    final_exam_attempt_id UUID REFERENCES exam_attempts(id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'NOT_ISSUED'
        CHECK (status IN ('NOT_ISSUED', 'ISSUED', 'NEEDS_REVIEW', 'REISSUED', 'REVOKED')),
    certificate_no VARCHAR(40) NOT NULL UNIQUE,
    verification_code VARCHAR(80) NOT NULL UNIQUE,
    pdf_storage_path TEXT,
    issued_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    version_no INTEGER NOT NULL DEFAULT 0 CHECK (version_no >= 0),
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_student
    ON certificates(student_id);

CREATE INDEX IF NOT EXISTS idx_certificates_course
    ON certificates(course_id);

CREATE INDEX IF NOT EXISTS idx_certificates_verification_code
    ON certificates(verification_code);
