package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Question;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record QuestionResponse(
        UUID id,
        String content,
        String explanation,
        String difficulty,
        String type,
        String status,
        Integer usageCount,
        UUID categoryId,
        String categoryName,
        Integer grade,
        UUID chapterId,
        String chapterTitle,
        Instant createdAt,
        List<ChoiceResponse> choices
) {
    public record ChoiceResponse(UUID id, String content, Boolean isCorrect, Integer position) {}

    public static QuestionResponse fromEntity(Question q) {
        List<ChoiceResponse> choices = q.getChoices().stream()
                .map(c -> new ChoiceResponse(c.getId(), c.getContent(),
                                             c.getIsCorrect(), c.getPosition()))
                .toList();
        return new QuestionResponse(
                q.getId(), q.getContent(), q.getExplanation(),
                q.getDifficulty(), q.getType(), q.getStatus(), q.getUsageCount(),
                q.getCategory() != null ? q.getCategory().getId() : null,
                q.getCategory() != null ? q.getCategory().getName() : null,
                q.getGrade(),
                q.getChapter() != null ? q.getChapter().getId() : null,
                q.getChapter() != null ? q.getChapter().getTitle() : null,
                q.getCreatedAt(), choices
        );
    }

    public static QuestionResponse forStudent(Question q) {
        List<ChoiceResponse> choices = q.getChoices().stream()
                .map(c -> new ChoiceResponse(c.getId(), c.getContent(), null, c.getPosition()))
                .toList();
        return new QuestionResponse(
                q.getId(), q.getContent(), null,
                q.getDifficulty(), q.getType(), q.getStatus(), q.getUsageCount(),
                null, null, null, null, null, null, choices
        );
    }
}
