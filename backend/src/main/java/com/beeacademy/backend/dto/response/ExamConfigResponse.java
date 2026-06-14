package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ExamConfig;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExamConfigResponse(
        UUID id,
        UUID courseId,
        Integer slotIndex,
        String name,
        String description,
        Integer durationMinutes,
        Integer passScorePercent,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        Boolean showAnswerAfterSubmit,
        List<ExamQuestionResponse> questions,
        Instant createdAt,
        Instant updatedAt
) {
    public record ExamQuestionResponse(
            String id,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            String explanation,
            Double points,
            String difficulty
    ) {}

    public static ExamConfigResponse fromEntity(ExamConfig config, ObjectMapper mapper) {
        return new ExamConfigResponse(
                config.getId(),
                config.getCourse().getId(),
                config.getSlotIndex(),
                config.getName(),
                config.getDescription(),
                config.getDurationMinutes(),
                config.getPassScorePercent(),
                config.getMaxAttempts(),
                config.getShuffleQuestions(),
                config.getShuffleOptions(),
                config.getShowAnswerAfterSubmit(),
                parseQuestions(config.getQuestionsJson(), mapper),
                config.getCreatedAt(),
                config.getUpdatedAt()
        );
    }

    private static List<ExamQuestionResponse> parseQuestions(String json, ObjectMapper mapper) {
        try {
            return mapper.readValue(json, new TypeReference<List<ExamQuestionResponse>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
