package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

/**
 * Kết quả sau khi học sinh nộp bài.
 * Kèm đáp án đúng + giải thích từng câu.
 */
public record QuizResultResponse(
        UUID attemptId,
        Double score,           // thang 10
        Boolean passed,
        Integer correctCount,
        Integer totalCount,
        Integer attemptNumber,
        List<QuestionResult> details
) {
    public record QuestionResult(
            UUID questionId,
            String content,
            UUID studentAnswer,      // choiceId học sinh chọn (null = bỏ trống)
            UUID correctAnswer,      // choiceId đúng
            Boolean isCorrect,
            String explanation
    ) {}
}
