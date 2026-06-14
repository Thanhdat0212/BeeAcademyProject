package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QuizConfig;

import java.util.List;
import java.util.UUID;

/** Config quiz của một chương — dùng cho trang /teacher/quiz/:chapterId. */
public record QuizConfigResponse(
        UUID id,
        UUID chapterId,
        Integer totalQuestions,
        Integer easyCount,
        Integer mediumCount,
        Integer hardCount,
        Integer timeLimitMinutes,
        Double passingScore,
        Boolean shuffleQuestions,
        Boolean shuffleChoices,
        Integer maxAttempts,
        String selectionMode,
        List<UUID> selectedQuestionIds
) {
    public static QuizConfigResponse fromEntity(QuizConfig c) {
        return new QuizConfigResponse(
                c.getId(), c.getChapter().getId(),
                c.getTotalQuestions(), c.getEasyCount(),
                c.getMediumCount(), c.getHardCount(),
                c.getTimeLimitMinutes(),
                c.getPassingScore() != null ? c.getPassingScore().doubleValue() : null,
                c.getShuffleQuestions(), c.getShuffleChoices(),
                c.getMaxAttempts(),
                c.getSelectionMode(),
                c.getSelectedQuestionIds()
        );
    }
}
