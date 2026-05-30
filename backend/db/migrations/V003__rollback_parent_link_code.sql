-- =============================================================================
-- V003__rollback_parent_link_code.sql
-- Xóa cơ chế sinh mã liên kết parent_link_code khỏi bảng profiles.
-- =============================================================================

-- 1. Xóa trigger tự động sinh mã liên kết
DROP TRIGGER IF EXISTS trg_generate_parent_link_code ON public.profiles;

-- 2. Xóa function sinh mã liên kết ngẫu nhiên
DROP FUNCTION IF EXISTS generate_parent_link_code();

-- 3. Xóa cột parent_link_code khỏi bảng profiles
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS parent_link_code;
