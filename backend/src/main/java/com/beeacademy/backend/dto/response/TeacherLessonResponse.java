package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Lesson;

import java.util.UUID;

/** Thông tin bài giảng phía GV — kèm đường dẫn storage để biết video đã upload chưa. */
public record TeacherLessonResponse(
        UUID id,
        String title,
        String description,
        Integer position,
        Boolean isFree,
        String videoEmbedUrl,
        String videoStoragePath,   // null = chưa upload video
        String videoUrl,           // URL public (cũ) hoặc null
        Integer durationSec,
        boolean hasVideo           // convenience flag cho FE
) {
    public static TeacherLessonResponse fromEntity(Lesson l) {
        boolean hasVideo = l.getVideoStoragePath() != null || l.getVideoUrl() != null
                           || l.getVideoEmbedUrl() != null;
        return new TeacherLessonResponse(
                l.getId(), l.getTitle(), l.getDescription(),
                l.getPosition(), l.getIsFree(),
                l.getVideoEmbedUrl(), l.getVideoStoragePath(), l.getVideoUrl(),
                l.getDurationSec(), hasVideo
        );
    }
}
