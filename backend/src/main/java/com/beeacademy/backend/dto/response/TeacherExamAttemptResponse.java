package com.beeacademy.backend.dto.response;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TeacherExamAttemptResponse(
        UUID id,
        UUID studentId,
        String studentName,
        UUID courseId,
        String courseTitle,
        UUID examId,
        String examName,
        Integer slotIndex,
        Integer attemptNumber,
        Instant startedAt,
        Instant submittedAt,
        Double autoScorePercent,
        Double manualScorePercent,
        Double effectiveScorePercent,
        Integer passScorePercent,
        Boolean passed,
        String feedback,
        Instant gradedAt,
        Double aiScorePercent,
        JsonNode aiFeedback,
        Instant aiGradedAt,
        String status,
        List<QuestionReview> questions
) {
    public record QuestionReview(
            String id,
            String text,
            String type,
            List<String> options,
            JsonNode metadata,
            List<Integer> studentAnswers,
            String textAnswer,
            List<String> imageUrls,
            JsonNode answerData,
            List<Integer> correctAnswers,
            Boolean correct,
            Double points,
            Double earnedPoints,
            String explanation
    ) {
    }
}
