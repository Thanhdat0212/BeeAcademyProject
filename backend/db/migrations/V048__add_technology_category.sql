-- V048: Bổ sung môn Công nghệ vào danh mục dùng chung của hệ thống.
--
-- Danh mục được dùng đồng thời cho khóa học, bộ lọc khóa học, ngân hàng câu hỏi,
-- AI Scan và đề kiểm tra. Slug `cong-nghe` là khóa tự nhiên mà frontend dùng
-- trên URL, còn UUID cố định giúp các môi trường có cùng dữ liệu tham chiếu.

INSERT INTO public.categories (id, slug, name, icon, display_order)
VALUES (
    'a8a5c1ad-52e4-4f60-9b51-47fabed9ae41',
    'cong-nghe',
    'Công nghệ',
    '⚙️',
    COALESCE((SELECT MAX(display_order) + 1 FROM public.categories), 1)
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    icon = EXCLUDED.icon;

