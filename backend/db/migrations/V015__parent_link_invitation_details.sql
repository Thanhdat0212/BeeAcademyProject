-- Gốc team3/develop là V014__parent_link_invitation_details.sql.
-- Đổi sang V015 khi gộp về local sau khi V013-trùng được tách thành V014 (rule Flyway, git-workflow.md).
ALTER TABLE public.parent_student_links
ADD COLUMN IF NOT EXISTS relationship VARCHAR(30) NOT NULL DEFAULT 'guardian',
ADD COLUMN IF NOT EXISTS note VARCHAR(500);

