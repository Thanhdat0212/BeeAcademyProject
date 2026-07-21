-- V046: Tài khoản giáo viên do Admin cấp
--
-- Bối cảnh: hệ thống không còn cho đăng ký công khai vai trò giáo viên.
-- GV liên hệ Bee Academy qua mạng xã hội, Admin tạo tài khoản + cấp mật khẩu tạm.
-- Mật khẩu tạm đã đi qua kênh ngoài hệ thống (Zalo/Facebook/email) nên GV
-- bắt buộc phải đổi ở lần đăng nhập đầu tiên.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.profiles(id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS teacher_contact_note TEXT;

COMMENT ON COLUMN public.profiles.must_change_password
    IS 'Bật khi Admin cấp mật khẩu tạm; tự tắt sau khi user đổi mật khẩu thành công.';
COMMENT ON COLUMN public.profiles.teacher_contact_note
    IS 'Kênh liên hệ Admin đã dùng để trao tài khoản cho GV (link Facebook/Zalo/SĐT).';

-- ---------------------------------------------------------------------------
-- Tạo lại view profiles_with_email (Admin UC35) để bổ sung 2 cột mới.
-- LƯU Ý: AdminUserResponse.fromRow đọc kết quả theo CHỈ SỐ VỊ TRÍ →
-- cột mới phải APPEND vào cuối, không được chèn vào giữa.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.profiles_with_email;

CREATE VIEW public.profiles_with_email AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  CAST(p.role AS TEXT)  AS role,
  p.is_blocked,
  p.created_at,
  u.email,
  p.teacher_approval_status,
  p.must_change_password
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

GRANT SELECT ON public.profiles_with_email TO postgres;
GRANT SELECT ON public.profiles_with_email TO authenticator;
GRANT SELECT ON public.profiles_with_email TO authenticated;
