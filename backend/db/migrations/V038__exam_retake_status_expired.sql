-- Đồng bộ BRULE-RETAKE-001 với SRS 4.14: thêm trạng thái EXPIRED cho
-- exam_retake_requests (lượt duyệt quá retake_expire_at mà học sinh chưa PASSED).
-- request_count/approval_count/cooldown_until không cần cột riêng — tính động
-- từ các dòng exam_retake_requests hiện có (đúng ghi chú SRS 4.14: "các trường
-- retake là dữ liệu derived").

ALTER TABLE exam_retake_requests DROP CONSTRAINT IF EXISTS exam_retake_requests_status_check;
ALTER TABLE exam_retake_requests ADD CONSTRAINT exam_retake_requests_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'));
