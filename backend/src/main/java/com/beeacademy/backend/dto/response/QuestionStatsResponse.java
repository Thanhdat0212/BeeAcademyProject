package com.beeacademy.backend.dto.response;

/**
 * Thống kê số lượng câu hỏi trong ngân hàng theo độ khó.
 * Dùng trên trang cấu hình quiz để cảnh báo GV nếu thiếu câu.
 */
public record QuestionStatsResponse(
        int easyCount,
        int mediumCount,
        int hardCount,
        int totalActive
) {
    public int total() { return easyCount + mediumCount + hardCount; }
}
