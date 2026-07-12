ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS teacher_approval_status VARCHAR(24) NOT NULL DEFAULT 'approved';

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_profiles_teacher_approval_status;

ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_teacher_approval_status
    CHECK (teacher_approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_profiles_teacher_approval_status
    ON public.profiles (role, teacher_approval_status)
    WHERE role = 'teacher';
