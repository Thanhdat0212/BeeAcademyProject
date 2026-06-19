package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

public record StudentExamSummaryResponse(
        UUID examId,
        Integer slotIndex,
        String name,
        String description,
        Integer durationMinutes,
        Integer passScorePercent,
        Integer maxAttempts,
        Boolean configured,
        Boolean unlocked,
        Boolean passed,
        Double latestScorePercent,
        Integer attemptsUsed,
        Integer requiredQuizCount,
        Integer passedQuizCount,
        String lockedReason,
        List<RequiredChapter> requiredChapters
) {
    public record RequiredChapter(
            UUID chapterId,
            String title,
            Boolean hasQuiz,
            Boolean quizPassed
    ) {}
}
