package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QuestionAuditLog;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

public record QuestionAuditLogResponse(
        UUID id,
        UUID teacherId,
        UUID questionId,
        Integer oldVersion,
        Integer newVersion,
        String action,
        JsonNode oldState,
        JsonNode newState,
        Instant createdAt) {

    public static QuestionAuditLogResponse fromEntity(QuestionAuditLog log, ObjectMapper mapper) {
        return new QuestionAuditLogResponse(
                log.getId(),
                log.getTeacherId(),
                log.getQuestionId(),
                log.getOldVersion(),
                log.getNewVersion(),
                log.getAction(),
                parseJson(log.getOldState(), mapper),
                parseJson(log.getNewState(), mapper),
                log.getCreatedAt());
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
}
