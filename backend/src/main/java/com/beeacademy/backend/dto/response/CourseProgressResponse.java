package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

public record CourseProgressResponse(
        UUID courseId,
        Integer progressPct,
        List<UUID> completedLessonIds,
        List<UUID> completedQuizIds
) {
}
