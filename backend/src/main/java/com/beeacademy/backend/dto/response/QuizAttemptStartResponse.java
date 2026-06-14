package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

/**
 * Response khi học sinh bắt đầu làm quiz.
 * Câu hỏi ĐÃ ẨN isCorrect và explanation — chỉ trả sau khi nộp bài.
 */
public record QuizAttemptStartResponse(
        UUID attemptId,
        Integer timeLimitMinutes,   // null = không giới hạn
        Integer totalQuestions,
        Integer attemptNumber,
        List<QuestionForStudent> questions
) {
    /** Câu hỏi dành cho học sinh — không có đáp án đúng. */
    public record QuestionForStudent(
            UUID id,
            String content,
            String type,
            List<ChoiceForStudent> choices
    ) {}

    public record ChoiceForStudent(UUID id, String content, Integer position) {}
}
