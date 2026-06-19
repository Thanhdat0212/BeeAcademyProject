package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

public record StudentExamStartResponse(
        UUID attemptId,
        UUID examId,
        Integer slotIndex,
        String name,
        String description,
        Integer durationMinutes,
        Integer totalQuestions,
        Integer attemptNumber,
        List<QuestionForStudent> questions
) {
    public record QuestionForStudent(
            String id,
            String text,
            String type,
            List<String> options,
            Double points
    ) {}
}
