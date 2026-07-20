package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ExamConfig;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExamConfigResponse(
        UUID id,
        UUID courseId,
        UUID courseVersionId,
        Integer slotIndex,
        UUID scopeStartChapterId,
        String scopeStartChapterTitle,
        UUID placementChapterId,
        String placementChapterTitle,
        String examType,
        String name,
        String description,
        Integer durationMinutes,
        Integer passScorePercent,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        Boolean showAnswerAfterSubmit,
        Boolean requireFullscreen,
        Boolean blockCopyPaste,
        List<ExamQuestionResponse> questions,
        Instant createdAt,
        Instant updatedAt
) {
    public record ExamQuestionResponse(
            String id,
            UUID questionVersionId,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            JsonNode metadata,
            String explanation,
            Double points,
            String difficulty
    ) {}

    public static ExamConfigResponse fromEntity(ExamConfig config, ObjectMapper mapper) {
        return new ExamConfigResponse(
                config.getId(),
                config.getCourse().getId(),
                config.getCourseVersionId(),
                config.getSlotIndex(),
                config.getScopeStartChapter() != null ? config.getScopeStartChapter().getId() : null,
                config.getScopeStartChapter() != null ? config.getScopeStartChapter().getTitle() : null,
                config.getPlacementChapter() != null ? config.getPlacementChapter().getId() : null,
                config.getPlacementChapter() != null ? config.getPlacementChapter().getTitle() : null,
                config.getExamType(),
                config.getName(),
                config.getDescription(),
                config.getDurationMinutes(),
                config.getPassScorePercent(),
                config.getMaxAttempts(),
                config.getShuffleQuestions(),
                config.getShuffleOptions(),
                config.getShowAnswerAfterSubmit(),
                config.getRequireFullscreen(),
                config.getBlockCopyPaste(),
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
