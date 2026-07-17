package com.beeacademy.backend.dto.response;

import java.util.List;

/**
 * Gói dữ liệu học tập cho trang chi tiết khóa học (learning view) trong MỘT
 * response — tiến độ, danh sách bài kiểm tra, và vị trí video gần nhất.
 *
 * <p>Trước đây frontend phải gọi 3 endpoint riêng khi mở trang học
 * (progress + exams + video-progress/latest), mỗi call tốn thêm một vòng
 * xác thực JWT + round-trip mạng. Endpoint tổng hợp giảm còn 1 call.
 * Các endpoint lẻ vẫn giữ nguyên cho các trang khác dùng.
 */
public record StudentLearningContextResponse(
        CourseProgressResponse progress,
        List<StudentExamResponse> exams,
        StudentVideoProgressResponse latestVideoProgress
) {
}
