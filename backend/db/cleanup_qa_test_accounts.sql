-- ============================================================================
--  Dọn tài khoản test rác do bộ Postman cũ sinh ra
--  (pre-request script cũ tạo email qa_<timestamp>_<random>@example.com mỗi lần chạy)
--
--  LƯU Ý SCHEMA: bảng public.profiles KHÔNG có cột email. Email nằm ở bảng
--  auth.users (Supabase GoTrue); profiles liên kết qua cột id (profiles.id = auth.users.id).
--  → Mọi điều kiện lọc theo email phải đặt trên auth.users, không phải profiles.
--
--  CÁCH DÙNG trên Supabase SQL Editor:
--    1) Chạy BƯỚC 0 để XEM TRƯỚC số account sẽ bị xóa.
--    2) Nếu đúng, bỏ comment khối BEGIN...COMMIT ở BƯỚC 1+2 rồi chạy.
--
--  Regex chỉ khớp account RÁC: qa_<chỉ-số>_<chỉ-số>@example.com
--  → KHÔNG đụng 'qa_tester@example.com' (account cố định mới) và 'qa.dev@example.com'.
-- ============================================================================

-- ── BƯỚC 0: XEM TRƯỚC (không xóa gì) ────────────────────────────────────────
SELECT id, email, created_at
FROM auth.users
WHERE email ~ '^qa_[0-9]+_[0-9]+@example\.com$'
ORDER BY created_at DESC;

-- Đếm tổng:
-- SELECT count(*) FROM auth.users WHERE email ~ '^qa_[0-9]+_[0-9]+@example\.com$';


-- ── BƯỚC 1 + 2: XÓA (chạy khi đã xác nhận ở bước 0) ─────────────────────────
-- Bỏ comment cả khối BEGIN...COMMIT bên dưới rồi chạy.
--
-- Thứ tự bắt buộc: xóa public.profiles TRƯỚC (vì lọc bằng subquery đọc auth.users),
-- rồi mới xóa auth.users. Các bảng con (enrollments/reviews/...) đa số ON DELETE
-- CASCADE theo profiles nên tự dọn.

-- BEGIN;
--
--     -- Xóa profile ứng dụng — lọc qua id của các account qa trong auth.users
--     DELETE FROM public.profiles
--     WHERE id IN (
--         SELECT id FROM auth.users
--         WHERE email ~ '^qa_[0-9]+_[0-9]+@example\.com$'
--     );
--
--     -- Xóa bản ghi auth thật (Supabase Authentication)
--     DELETE FROM auth.users
--     WHERE email ~ '^qa_[0-9]+_[0-9]+@example\.com$';
--
-- COMMIT;


-- ── BƯỚC 3: DỌN PROFILE MỒ CÔI (khi auth.users đã bị xóa nhưng profiles còn) ─
-- Tình huống: nếu lần xóa trước chạy nửa chừng (DELETE auth.users đã commit còn
-- DELETE profiles lỗi), profiles 'QA Tester' bị bỏ lại, không còn auth.users để
-- join email. Điều kiện id NOT IN (auth.users) chỉ xóa đúng các profile mồ côi.

-- Xem trước:
SELECT id, full_name, role, created_at
FROM public.profiles
WHERE full_name = 'QA Tester'
  AND id NOT IN (SELECT id FROM auth.users)
ORDER BY created_at DESC;

-- Xóa (bỏ comment khi đã xác nhận):
-- DELETE FROM public.profiles
-- WHERE full_name = 'QA Tester'
--   AND id NOT IN (SELECT id FROM auth.users);


-- ── (Tùy chọn) Xóa LUÔN account cố định qa_tester nếu không muốn giữ ─────────
-- DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'qa_tester@example.com');
-- DELETE FROM auth.users WHERE email = 'qa_tester@example.com';
