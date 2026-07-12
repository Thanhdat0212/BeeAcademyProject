package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.StudentVideoProgress;
import com.beeacademy.backend.dto.learning.VideoWatchedSegment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudentVideoProgressResponse(
        UUID lessonId,
        int positionSec,
        int durationSec,
        Instant updatedAt,
        List<VideoWatchedSegment> watchedSegments,
        int watchedDurationSec,
        boolean completed
) {
    public static StudentVideoProgressResponse empty(UUID lessonId) {
        return new StudentVideoProgressResponse(lessonId, 0, 0, null, List.of(), 0, false);
    }

    public static StudentVideoProgressResponse fromEntity(
            StudentVideoProgress progress,
            List<VideoWatchedSegment> watchedSegments,
            int watchedDurationSec,
            boolean completed) {
        return new StudentVideoProgressResponse(
                progress.getLesson().getId(),
                progress.getPositionSec(),
                progress.getDurationSec(),
                progress.getUpdatedAt(),
                watchedSegments,
                watchedDurationSec,
                completed
        );
    }
}
