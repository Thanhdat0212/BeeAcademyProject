package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QuestionVersion;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record QuestionVersionResponse(
        UUID id,
        Integer versionNo,
        UUID questionBankId,
        UUID categoryId,
        Integer grade,
        UUID chapterId,
        String content,
        String explanation,
        Double defaultPoints,
        List<String> tags,
        JsonNode metadata,
        String difficulty,
        String type,
        String status,
        JsonNode choices,
        String changeReason,
        Instant createdAt) {

    public static QuestionVersionResponse fromEntity(QuestionVersion version, ObjectMapper mapper) {
        return new QuestionVersionResponse(
                version.getId(),
                version.getVersionNo(),
                version.getQuestionBankId(),
                version.getCategoryId(),
                version.getGrade(),
                version.getChapterId(),
                version.getContent(),
                version.getExplanation(),
                version.getDefaultPoints(),
                parseStringList(version.getTagsJson(), mapper),
                parseJson(version.getMetadataJson(), mapper),
                version.getDifficulty(),
                version.getType(),
                version.getStatus(),
                parseJson(version.getChoicesJson(), mapper),
                version.getChangeReason(),
                version.getCreatedAt());
    }

    private static JsonNode parseJson(String json, ObjectMapper mapper) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return mapper.readTree(json);
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
