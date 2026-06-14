-- =============================================================================
-- V002__add_parent_portal.sql
-- Thêm cột parent_link_code vào bảng profiles và tạo bảng parent_student_links.
-- =============================================================================

-- 1. Thêm cột parent_link_code vào bảng profiles dành riêng cho học sinh
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS parent_link_code VARCHAR(6) UNIQUE;

-- 2. Tạo bảng liên kết phụ huynh và học sinh (parent_student_links)
CREATE TABLE IF NOT EXISTS public.parent_student_links (
    parent_id UUID NOT NULL,
    student_id UUID NOT NULL,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT pk_parent_student_links PRIMARY KEY (parent_id, student_id),
    CONSTRAINT fk_link_parent FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_link_student FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Tạo Index để tối ưu hóa hiệu năng truy vấn liên kết
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON public.parent_student_links(student_id);

-- 3. Tạo function và trigger để tự động sinh mã liên kết 6 ký tự dạng BEE + 3 chữ số (ví dụ: BEE123) cho học sinh mới
CREATE OR REPLACE FUNCTION generate_parent_link_code() 
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    -- Chỉ sinh mã đối với học sinh (student) khi chưa có mã
    IF NEW.role = 'student'::user_role AND NEW.parent_link_code IS NULL THEN
        LOOP
            -- Sinh mã ngẫu nhiên dạng BEE + 3 số ngẫu nhiên
            new_code := 'BEE' || lpad(floor(random() * 1000)::text, 3, '0');
            
            -- Kiểm tra trùng lặp mã trong bảng profiles
            SELECT EXISTS(SELECT 1 FROM public.profiles WHERE parent_link_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        NEW.parent_link_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Xóa trigger cũ nếu tồn tại để tránh lỗi trùng lặp khi chạy lại
DROP TRIGGER IF EXISTS trg_generate_parent_link_code ON public.profiles;

-- Gắn trigger vào bảng profiles trước khi insert
CREATE TRIGGER trg_generate_parent_link_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_parent_link_code();

-- 4. Chạy cập nhật sinh mã liên kết ngẫu nhiên an toàn cho các học sinh hiện tại chưa có mã
DO $$
DECLARE
    rec RECORD;
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    FOR rec IN SELECT id FROM public.profiles WHERE role = 'student'::user_role AND parent_link_code IS NULL LOOP
        LOOP
            new_code := 'BEE' || lpad(floor(random() * 1000)::text, 3, '0');
            SELECT EXISTS(SELECT 1 FROM public.profiles WHERE parent_link_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        UPDATE public.profiles SET parent_link_code = new_code WHERE id = rec.id;
    END LOOP;
END $$;

