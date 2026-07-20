package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Question;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record QuestionResponse(
        UUID id,
        String content,
        String explanation,
        Double defaultPoints,
        List<String> tags,
        JsonNode metadata,
        String difficulty,
        String type,
        String status,
        Integer usageCount,
        UUID questionBankId,
        String questionBankTitle,
        UUID categoryId,
        String categoryName,
        Integer grade,
        UUID chapterId,
        String chapterTitle,
        Instant createdAt,
        String duplicateWarning,
        List<ChoiceResponse> choices
) {
    public record ChoiceResponse(UUID id, String content, Boolean isCorrect, Integer position) {}

    public static QuestionResponse fromEntity(Question q, ObjectMapper mapper) {
        List<ChoiceResponse> choices = q.getChoices().stream()
                .map(c -> new ChoiceResponse(c.getId(), c.getContent(), c.getIsCorrect(), c.getPosition()))
                .toList();
        return new QuestionResponse(
                q.getId(),
                q.getContent(),
                q.getExplanation(),
                q.getDefaultPoints(),
                parseStringList(q.getTagsJson(), mapper),
                parseMetadata(q.getMetadataJson(), mapper),
                q.getDifficulty(),
                q.getType(),
                q.getStatus(),
                q.getUsageCount(),
                q.getQuestionBank() != null ? q.getQuestionBank().getId() : null,
                q.getQuestionBank() != null ? q.getQuestionBank().getTitle() : null,
                q.getCategory() != null ? q.getCategory().getId() : null,
                q.getCategory() != null ? q.getCategory().getName() : null,
                q.getGrade(),
                q.getChapter() != null ? q.getChapter().getId() : null,
                q.getChapter() != null ? q.getChapter().getTitle() : null,
                q.getCreatedAt(),
                null,
                choices
        );
    }

    public QuestionResponse withDuplicateWarning(String warning) {
        return new QuestionResponse(
                id,
                content,
                explanation,
                defaultPoints,
                tags,
                metadata,
                difficulty,
                type,
                status,
                usageCount,
                questionBankId,
                questionBankTitle,
                categoryId,
                categoryName,
                grade,
                chapterId,
                chapterTitle,
                createdAt,
                warning,
                choices);
    }

    public static QuestionResponse forStudent(Question q, ObjectMapper mapper) {
        List<ChoiceResponse> choices = q.getChoices().stream()
                .map(c -> new ChoiceResponse(c.getId(), c.getContent(), null, c.getPosition()))
                .toList();
        return new QuestionResponse(
                q.getId(),
                q.getContent(),
                null,
                q.getDefaultPoints(),
                parseStringList(q.getTagsJson(), mapper),
                parseMetadata(q.getMetadataJson(), mapper),
                q.getDifficulty(),
                q.getType(),
                q.getStatus(),
                q.getUsageCount(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                choices
        );
    }

    private static JsonNode parseMetadata(String metadataJson, ObjectMapper mapper) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return null;
        }
        try {
            return mapper.readTree(metadataJson);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static List<String> parseStringList(String json, ObjectMapper mapper) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return mapper.readerForListOf(String.class).readValue(json);
        } catch (Exception ignored) {
            return List.of();
        }
    }
}
