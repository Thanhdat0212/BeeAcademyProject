-- Đồng bộ CHECK constraint `category` của bảng complaints với đầy đủ các loại
-- khiếu nại mà frontend (HS/PH/GV) gửi lên.
--
-- DB thật (sau merge team3) chỉ còn 7 loại cũ → HS chọn "Giáo viên" (teacher),
-- "Nội dung khóa học" (course_content), "Chấm điểm" (grading), "Liên kết phụ
-- huynh" (parent_link)... bị vi phạm CHECK → INSERT lỗi 500. Mở rộng đủ 12 loại
-- khớp regexp ở CreateComplaintRequest.

ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS chk_complaints_category;
ALTER TABLE public.complaints ADD CONSTRAINT chk_complaints_category
    CHECK (category IN (
        'payment', 'course_review', 'bank_verify', 'student_report',
        'content', 'course_content', 'teacher', 'grading',
        'parent_link', 'technical', 'system', 'other'
    ));
