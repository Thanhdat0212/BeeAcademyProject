package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Kết quả AI chấm sơ bộ một lượt làm bài kiểm tra (exam).
 * Điểm % gộp phần trắc nghiệm (chấm tự động) + phần tự luận do AI chấm.
 * Điểm chính thức vẫn do giáo viên quyết định.
 */
public record AiExamGradeResponse(
        UUID attemptId,
        Double aiScorePercent,
        String overallComment,
        List<String> strengths,
        List<String> improvements,
        List<QuestionGrade> questions,
        Instant aiGradedAt,
        String disclaimer
) {
    public record QuestionGrade(
            String questionId,
            String questionText,
            String type,
            Double earnedPoints,
            Double maxPoints,
            String studentAnswer,
            List<String> imageUrls,
            String comment,
            List<String> suggestions
    ) {
    }
}
