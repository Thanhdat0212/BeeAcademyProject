package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/** Teacher-facing lesson metadata, including slide cues and fallback video source. */
public record TeacherLessonResponse(
        UUID id,
        String title,
        String description,
        Integer position,
        Boolean isFree,
        String videoEmbedUrl,
        String videoStoragePath,
        String videoUrl,
        String videoFallbackUrl,
        String hlsPlaylistUrl,
        String videoProcessingStatus,
        java.time.Instant originalVideoRetentionUntil,
        Integer durationSec,
        boolean hasVideo,
        String completionRule,
        String transcript,
        String subtitleUrl,
        String slideCueSeconds,
        List<DocumentDto> documents
) {
    public record DocumentDto(UUID id, String name, String fileType, Integer position) {
        public static DocumentDto fromEntity(CourseDocument document) {
            return new DocumentDto(
                    document.getId(), document.getName(), document.getFileType(),
                    document.getPosition());
        }
    }

    public static TeacherLessonResponse fromEntity(Lesson lesson) {
        return fromEntity(lesson, Collections.emptyList());
    }

    public static TeacherLessonResponse fromEntity(Lesson lesson, List<CourseDocument> documents) {
        boolean hasVideo = lesson.getVideoStoragePath() != null || lesson.getVideoUrl() != null
                           || lesson.getVideoEmbedUrl() != null;
        List<DocumentDto> documentDtos = documents == null
                ? Collections.emptyList()
                : documents.stream().map(DocumentDto::fromEntity).toList();
        return new TeacherLessonResponse(
                lesson.getId(), lesson.getTitle(), lesson.getDescription(),
                lesson.getPosition(), lesson.getIsFree(),
                lesson.getVideoEmbedUrl(), lesson.getVideoStoragePath(), lesson.getVideoUrl(),
                lesson.getVideoFallbackUrl(), lesson.getHlsPlaylistUrl(), lesson.getVideoProcessingStatus(),
                lesson.getOriginalVideoRetentionUntil(), lesson.getDurationSec(), hasVideo,
                lesson.getCompletionRule(), lesson.getTranscript(), lesson.getSubtitleUrl(),
                lesson.getSlideCueSeconds(), documentDtos
        );
    }
}
