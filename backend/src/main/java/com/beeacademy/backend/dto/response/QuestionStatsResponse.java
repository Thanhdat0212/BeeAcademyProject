package com.beeacademy.backend.dto.response;

/**
 * Thống kê số lượng câu hỏi trong ngân hàng theo độ khó.
 * Dùng trên trang cấu hình quiz để cảnh báo GV nếu thiếu câu.
 */
public record QuestionStatsResponse(
        int easyCount,
        int mediumCount,
        int hardCount,
        int totalActive,
        int multipleChoiceCount,
        int trueFalseCount,
        int fillInBlankCount,
        int imageQuestionCount,
        int essayCount,
        int totalExamSupported
) {
    public QuestionStatsResponse(int easyCount, int mediumCount, int hardCount, int totalActive) {
        this(easyCount, mediumCount, hardCount, totalActive, 0, 0, 0, 0, 0, 0);
    }

    public int total() { return easyCount + mediumCount + hardCount; }
}
