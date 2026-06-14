-- =============================================================================
-- V001__seed_courses.sql
-- Migrate dữ liệu mock từ frontend/src/data/mockCourses.ts vào Supabase Postgres.
--
-- Bao gồm:
--   1. Tạo 6 system teacher profiles (1 cho mỗi instructor có trong MOCK_COURSES).
--   2. Insert 9 khoá học (c1..c9), map subject → category đã seed sẵn.
--   3. Tạo 2 chapter mẫu cho mỗi khoá + 3 lesson cho mỗi chapter (1 free, 2 paid).
--
-- Cách chạy (3 lựa chọn):
--   - Supabase Dashboard → SQL Editor → paste & Run
--   - MCP: dùng tool `apply_migration` với name="seed_courses" + content file này
--   - psql: psql "$SUPABASE_DB_URL" -f V001__seed_courses.sql
--
-- An toàn re-run: dùng ON CONFLICT DO NOTHING ở các INSERT có UNIQUE constraint.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BƯỚC 1. Tạo system teachers
-- -----------------------------------------------------------------------------
-- Cần insert vào auth.users TRƯỚC (FK của profiles.id → auth.users.id).
-- Dùng UUID cố định để re-run idempotent.
--
-- LƯU Ý: trong production các teacher này KHÔNG đăng nhập được do mật khẩu
-- là hash placeholder. Admin sẽ thay thế bằng tài khoản giáo viên thật khi
-- hệ thống lên live.
-- -----------------------------------------------------------------------------

INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
) VALUES
    ('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.nguyenminh@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Thầy Nguyễn Minh","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.tranlan@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Cô Trần Lan","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.lecuong@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Thầy Lê Cường","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.phammai@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Cô Phạm Mai","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.buihoang@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Thầy Bùi Hoàng","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111106', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.nguyenlich@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Thầy Nguyễn Lịch","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111107', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.lehang@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Cô Lê Hằng","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111108', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.dangkhoi@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Thầy Đặng Khôi","role":"teacher"}'::jsonb,
     now(), now()),
    ('11111111-1111-1111-1111-111111111109', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'teacher.thanhnhan@beeacademy.local',
     '$2a$10$SEED_PLACEHOLDER_NEVER_LOGIN_DIRECTLY', now(),
     '{"provider":"seed","role":"teacher"}'::jsonb,
     '{"full_name":"Cô Thanh Nhàn","role":"teacher"}'::jsonb,
     now(), now())
ON CONFLICT (id) DO NOTHING;

-- Tạo profile cho từng auth user vừa insert
INSERT INTO public.profiles (id, role, full_name) VALUES
    ('11111111-1111-1111-1111-111111111101', 'teacher'::user_role, 'Thầy Nguyễn Minh'),
    ('11111111-1111-1111-1111-111111111102', 'teacher'::user_role, 'Cô Trần Lan'),
    ('11111111-1111-1111-1111-111111111103', 'teacher'::user_role, 'Thầy Lê Cường'),
    ('11111111-1111-1111-1111-111111111104', 'teacher'::user_role, 'Cô Phạm Mai'),
    ('11111111-1111-1111-1111-111111111105', 'teacher'::user_role, 'Thầy Bùi Hoàng'),
    ('11111111-1111-1111-1111-111111111106', 'teacher'::user_role, 'Thầy Nguyễn Lịch'),
    ('11111111-1111-1111-1111-111111111107', 'teacher'::user_role, 'Cô Lê Hằng'),
    ('11111111-1111-1111-1111-111111111108', 'teacher'::user_role, 'Thầy Đặng Khôi'),
    ('11111111-1111-1111-1111-111111111109', 'teacher'::user_role, 'Cô Thanh Nhàn')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- BƯỚC 2. Insert 9 khoá học
-- -----------------------------------------------------------------------------
-- Mapping subject (frontend) → category_slug (Supabase):
--   Toán  → toan-hoc            Văn  → ngu-van
--   Lý    → khoa-hoc-tu-nhien   Hóa  → khoa-hoc-tu-nhien
--   Sử    → lich-su-dia-ly      Địa  → lich-su-dia-ly
--
-- UUID khoá học: cố định pattern 22222222-2222-2222-2222-22222222220X
-- để chapter/lesson FK ổn định, dễ debug.
-- -----------------------------------------------------------------------------

INSERT INTO public.courses (
    id, slug, title, description, thumbnail_url,
    category_id, teacher_id, grades,
    price_vnd, status, is_featured, published_at
) VALUES
    -- c1: Toán Đại Số Nâng Cao
    ('22222222-2222-2222-2222-222222222201',
     'toan-dai-so-nang-cao',
     'Toán Đại Số Nâng Cao',
     'Nắm vững các hằng đẳng thức và phương trình bậc nhất. Khóa học cung cấp kiến thức nền tảng vững chắc và các phương pháp giải quyết vấn đề phức tạp.',
     'https://images.unsplash.com/photo-1632516643720-e7f5d7d6eca9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'toan-hoc'),
     '11111111-1111-1111-1111-111111111101',
     ARRAY[8]::integer[],
     499000, 'published'::course_status, true, now()),

    -- c2: Văn Học Dân Gian Việt Nam
    ('22222222-2222-2222-2222-222222222202',
     'van-hoc-dan-gian-viet-nam',
     'Văn Học Dân Gian Việt Nam',
     'Khám phá ca dao, tục ngữ và truyền thuyết lịch sử. Hòa mình vào thế giới của Văn Học Dân Gian Việt Nam để hiểu sâu hơn về cội nguồn văn hóa dân tộc.',
     'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'ngu-van'),
     '11111111-1111-1111-1111-111111111102',
     ARRAY[6]::integer[],
     350000, 'published'::course_status, true, now()),

    -- c3: Vật Lý Khám Phá Điện Từ
    ('22222222-2222-2222-2222-222222222203',
     'vat-ly-kham-pha-dien-tu',
     'Vật Lý Khám Phá Điện Từ',
     'Thực hành ảo với nam châm và dòng điện. Một khóa học Vật Lý đầy thực tế, hướng dẫn thực hành ảo mô phỏng các hiện tượng vật lý thú vị.',
     'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'khoa-hoc-tu-nhien'),
     '11111111-1111-1111-1111-111111111103',
     ARRAY[9]::integer[],
     550000, 'published'::course_status, false, now()),

    -- c4: Toán Hình Học Không Gian
    ('22222222-2222-2222-2222-222222222204',
     'toan-hinh-hoc-khong-gian',
     'Toán Hình Học Không Gian',
     'Làm quen với hình chóp, hình lăng trụ và tính thể tích. Hình học không gian không còn là nỗi sợ với các công cụ hình ảnh 3D trực quan.',
     'https://images.unsplash.com/photo-1509228468518-180dd4864904?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'toan-hoc'),
     '11111111-1111-1111-1111-111111111104',
     ARRAY[9]::integer[],
     450000, 'published'::course_status, false, now()),

    -- c5: Hóa Học Cơ Bản: Phản Ứng Oxi Hóa
    ('22222222-2222-2222-2222-222222222205',
     'hoa-hoc-co-ban-phan-ung-oxi-hoa',
     'Hóa Học Cơ Bản: Phản Ứng Oxi Hóa',
     'Cân bằng phương trình hóa học cơ bản nhất. Khóa học giúp bạn vượt qua nỗi sợ hóa học với những mẹo mà sách giáo khoa không dạy.',
     'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'khoa-hoc-tu-nhien'),
     '11111111-1111-1111-1111-111111111105',
     ARRAY[8]::integer[],
     400000, 'published'::course_status, false, now()),

    -- c6: Lịch Sử Việt Nam: Kháng Chiến Chống Pháp
    ('22222222-2222-2222-2222-222222222206',
     'lich-su-viet-nam-khang-chien-chong-phap',
     'Lịch Sử Việt Nam: Kháng Chiến Chống Pháp',
     'Tìm hiểu về cuộc đấu tranh giành độc lập hào hùng. Tái hiện lại những trang sử qua góc nhìn đa chiều với tư liệu thực tế.',
     'https://images.unsplash.com/photo-1461360370896-922624d12aa1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'lich-su-dia-ly'),
     '11111111-1111-1111-1111-111111111106',
     ARRAY[9]::integer[],
     299000, 'published'::course_status, true, now()),

    -- c7: Địa Lý: Khí Hậu Các Vùng Miền
    ('22222222-2222-2222-2222-222222222207',
     'dia-ly-khi-hau-cac-vung-mien',
     'Địa Lý: Khí Hậu Các Vùng Miền',
     'Tổng quan về đặc điểm tự nhiên của đất nước. Hiểu rõ sự khác biệt thú vị về khí hậu giữa 3 miền Bắc – Trung – Nam.',
     'https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'lich-su-dia-ly'),
     '11111111-1111-1111-1111-111111111107',
     ARRAY[8]::integer[],
     250000, 'published'::course_status, false, now()),

    -- c8: Vật Lý 7: Ánh Sáng Và Âm Thanh
    ('22222222-2222-2222-2222-222222222208',
     'vat-ly-7-anh-sang-va-am-thanh',
     'Vật Lý 7: Ánh Sáng Và Âm Thanh',
     'Khám phá các hiện tượng vật lý trong đời sống. Âm thanh và ánh sáng truyền đi như thế nào? Cùng khám phá với những ví dụ sinh động.',
     'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'khoa-hoc-tu-nhien'),
     '11111111-1111-1111-1111-111111111108',
     ARRAY[7]::integer[],
     320000, 'published'::course_status, false, now()),

    -- c9: Toán Học Cơ Bản: Phân Số
    ('22222222-2222-2222-2222-222222222209',
     'toan-hoc-co-ban-phan-so',
     'Toán Học Cơ Bản: Phân Số',
     'Củng cố kiến thức nền tảng toán học lớp 6. Xây dựng lại tư duy học toán từ những phép tính phân số cơ bản nhất.',
     'https://images.unsplash.com/photo-1632516643720-e7f5d7d6eca9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
     (SELECT id FROM categories WHERE slug = 'toan-hoc'),
     '11111111-1111-1111-1111-111111111109',
     ARRAY[6]::integer[],
     199000, 'published'::course_status, false, now())
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- BƯỚC 3. Tạo chapter + lesson mẫu cho mỗi khoá
-- -----------------------------------------------------------------------------
-- Quy ước: mỗi khoá có 2 chapter, mỗi chapter có 3 lesson (lesson đầu free).
-- Pattern UUID:
--   Chapter:  33333333-3333-3333-3333-333333{course-suffix}{chap-no}
--   Lesson:   44444444-4444-4444-4444-444444{course-suffix}{lesson-no}
-- -----------------------------------------------------------------------------

-- Dùng DO block để loop qua từng khoá, tránh viết 9 x 2 x 3 = 54 INSERT thủ công.
DO $$
DECLARE
    course_ids UUID[] := ARRAY[
        '22222222-2222-2222-2222-222222222201',
        '22222222-2222-2222-2222-222222222202',
        '22222222-2222-2222-2222-222222222203',
        '22222222-2222-2222-2222-222222222204',
        '22222222-2222-2222-2222-222222222205',
        '22222222-2222-2222-2222-222222222206',
        '22222222-2222-2222-2222-222222222207',
        '22222222-2222-2222-2222-222222222208',
        '22222222-2222-2222-2222-222222222209'
    ];
    course_id UUID;
    chap1_id UUID;
    chap2_id UUID;
    idx INT := 0;
BEGIN
    FOREACH course_id IN ARRAY course_ids LOOP
        idx := idx + 1;
        -- 2 chapter cho mỗi khoá
        chap1_id := gen_random_uuid();
        chap2_id := gen_random_uuid();

        INSERT INTO public.chapters (id, course_id, title, description, position)
        VALUES
            (chap1_id, course_id, 'Chương 1: Mở đầu',
             'Giới thiệu tổng quan và những khái niệm nền tảng.', 1),
            (chap2_id, course_id, 'Chương 2: Nâng cao',
             'Đi sâu vào nội dung chính và bài tập vận dụng.', 2)
        ON CONFLICT (id) DO NOTHING;

        -- 3 lesson cho chapter 1 (lesson 1 free)
        INSERT INTO public.lessons (id, chapter_id, title, video_url, duration_sec, position, is_free)
        VALUES
            (gen_random_uuid(), chap1_id, 'Bài 1: Giới thiệu khoá học', 'https://example.com/intro.mp4', 600, 1, true),
            (gen_random_uuid(), chap1_id, 'Bài 2: Lý thuyết cơ bản',    'https://example.com/lesson2.mp4', 900, 2, false),
            (gen_random_uuid(), chap1_id, 'Bài 3: Bài tập áp dụng',     'https://example.com/lesson3.mp4', 1200, 3, false)
        ON CONFLICT (id) DO NOTHING;

        -- 3 lesson cho chapter 2 (toàn paid)
        INSERT INTO public.lessons (id, chapter_id, title, video_url, duration_sec, position, is_free)
        VALUES
            (gen_random_uuid(), chap2_id, 'Bài 4: Mở rộng kiến thức',   'https://example.com/lesson4.mp4', 1500, 1, false),
            (gen_random_uuid(), chap2_id, 'Bài 5: Bài tập nâng cao',    'https://example.com/lesson5.mp4', 1800, 2, false),
            (gen_random_uuid(), chap2_id, 'Bài 6: Tổng kết & ôn tập',   'https://example.com/lesson6.mp4', 2100, 3, false)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BƯỚC 4. Cập nhật denormalized counter trên bảng courses
-- -----------------------------------------------------------------------------
-- total_chapters, total_lessons, total_duration_sec là cache để query nhanh.
-- Schema gốc có thể đã có trigger tự maintain - chạy UPDATE này phòng trường
-- hợp trigger chưa được tạo ở môi trường dev.
-- -----------------------------------------------------------------------------

UPDATE public.courses c SET
    total_chapters = sub.total_chapters,
    total_lessons  = sub.total_lessons,
    total_duration_sec = sub.total_duration_sec
FROM (
    SELECT
        ch.course_id,
        COUNT(DISTINCT ch.id)                    AS total_chapters,
        COUNT(l.id)                              AS total_lessons,
        COALESCE(SUM(l.duration_sec), 0)::int    AS total_duration_sec
    FROM public.chapters ch
    LEFT JOIN public.lessons l ON l.chapter_id = ch.id
    GROUP BY ch.course_id
) AS sub
WHERE c.id = sub.course_id;

-- -----------------------------------------------------------------------------
-- Verify (chạy thủ công sau migration)
-- -----------------------------------------------------------------------------
-- SELECT c.title, cat.name AS category, p.full_name AS teacher,
--        c.grades, c.price_vnd, c.total_chapters, c.total_lessons
-- FROM courses c
-- LEFT JOIN categories cat ON cat.id = c.category_id
-- LEFT JOIN profiles p ON p.id = c.teacher_id
-- ORDER BY c.created_at;
