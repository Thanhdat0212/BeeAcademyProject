package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

public record StudentExamResultResponse(
        UUID attemptId,
        UUID examId,
        Integer slotIndex,
        Double scorePercent,
        Boolean passed,
        Double earnedPoints,
        Double totalPoints,
        Integer attemptNumber,
        List<QuestionResult> details
) {
    public record QuestionResult(
            String questionId,
            String text,
            List<Integer> studentAnswers,
            List<Integer> correctAnswers,
            Boolean isCorrect,
            String explanation,
            Double points
    ) {}
}
