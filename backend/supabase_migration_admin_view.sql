-- Migration: tạo view profiles_with_email cho Admin UC35
-- Chạy file này trên Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Lý do cần view:
--   Spring Boot app connect qua public schema — direct JOIN auth.users từ code
--   có thể bị lỗi "permission denied for schema auth" trên một số Supabase configs.
--   View được tạo bởi superuser (SQL Editor) nên có quyền join auth schema,
--   còn app chỉ cần SELECT trên public.profiles_with_email.

CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  CAST(p.role AS TEXT)  AS role,
  p.is_blocked,
  p.created_at,
  u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

-- Grant SELECT cho role mà Spring Boot dùng khi connect DB
GRANT SELECT ON public.profiles_with_email TO postgres;
GRANT SELECT ON public.profiles_with_email TO authenticator;
GRANT SELECT ON public.profiles_with_email TO authenticated;
