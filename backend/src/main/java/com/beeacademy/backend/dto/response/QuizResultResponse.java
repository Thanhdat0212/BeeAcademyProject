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
            List<UUID> studentAnswers,
            String studentAnswerText,
            List<UUID> correctAnswers,
            String correctAnswerText,
            Boolean isCorrect,
            String explanation
    ) {}
}
