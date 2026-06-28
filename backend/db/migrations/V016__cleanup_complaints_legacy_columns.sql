-- Dọn các cột rác còn sót trên bảng `complaints` sau khi merge team3.
--
-- Khi gộp schema, bảng `complaints` bị trộn hai phiên bản: bản UC11 hiện tại
-- (sender_id/title/category/priority/...) và bản cũ của team3
-- (user_id/subject/body/...). Các cột team3 `user_id`, `subject`, `body` là
-- NOT NULL và KHÔNG có default, trong khi entity `Complaint` không hề set chúng
-- → mọi INSERT khiếu nại đều vỡ ràng buộc NOT NULL (500). Bảng đang trống
-- (0 dòng) nên gỡ các cột này an toàn.
--
-- Chỉ gỡ cột mà entity hiện tại KHÔNG dùng. Giữ `status` và `resolved_at`
-- (entity vẫn map `status` + `resolvedAt`).

-- Policy RLS cũ của team3 tham chiếu cột `user_id` (qual: user_id = auth.uid()).
-- Backend gọi bằng service role nên bypass RLS → policy này vô tác dụng và
-- đang chặn việc gỡ cột. Drop nó trước.
DROP POLICY IF EXISTS complaints_rw_own ON public.complaints;

ALTER TABLE public.complaints DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS order_id;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS course_id;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS subject;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS body;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS admin_response;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS resolved_by;
