package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

public record LessonResponse(
        UUID id,
        String title,
        String videoUrl,
        String videoEmbedUrl,
        String videoFallbackUrl,
        String hlsPlaylistUrl,
        String videoProcessingStatus,
        Integer durationSec,
        Integer position,
        Boolean isFree,
        String completionRule,
        String transcript,
        String subtitleUrl,
        String slideCueSeconds,
        List<DocumentDto> documents
) {

    /** Tài liệu đính kèm — chỉ metadata, không bao giờ lộ URL storage. */
    public record DocumentDto(UUID id, String name, String fileUrl, String fileType,
                              Long fileSizeBytes, Integer position) {
        public static DocumentDto fromEntity(CourseDocument d, boolean exposePreviewUrl) {
            return new DocumentDto(d.getId(), d.getName(),
                    exposePreviewUrl ? d.getFileUrl() : null,
                    d.getFileType(), d.getFileSizeBytes(), d.getPosition());
        }
    }

    /** Map không có signed URL và không có documents. */
    public static LessonResponse fromEntity(Lesson lesson, boolean includeUrl) {
        return fromEntity(lesson, includeUrl, null, Collections.emptyList());
    }

    /** Map đầy đủ: signed URL + danh sách tài liệu. */
    public static LessonResponse fromEntity(Lesson lesson, boolean includeUrl,
                                             String signedUrl,
                                             List<CourseDocument> docs) {
        boolean canSee = includeUrl || Boolean.TRUE.equals(lesson.getIsFree());
        String videoUrl = canSee
                ? firstNonBlank(signedUrl, lesson.getVideoUrl())
                : null;
        String embedUrl = canSee ? firstNonBlank(lesson.getVideoEmbedUrl()) : null;

        List<DocumentDto> docDtos = (canSee && docs != null && !docs.isEmpty())
                ? docs.stream().map(d -> DocumentDto.fromEntity(d, false)).toList()
                : Collections.emptyList();

        return new LessonResponse(
                lesson.getId(),
                lesson.getTitle(),
                videoUrl,
                embedUrl,
                canSee ? lesson.getVideoFallbackUrl() : null,
                canSee ? lesson.getHlsPlaylistUrl() : null,
                lesson.getVideoProcessingStatus(),
                lesson.getDurationSec(),
                lesson.getPosition(),
                lesson.getIsFree(),
                lesson.getCompletionRule(),
                lesson.getTranscript(),
                lesson.getSubtitleUrl(),
                lesson.getSlideCueSeconds(),
                docDtos
        );
    }

    /** Compat overload giữ nguyên cho ChapterResponse.fromEntity cũ. */
    public static LessonResponse fromEntityWithSignedUrl(Lesson lesson, boolean canSee,
                                                          String signedUrl) {
        return fromEntity(lesson, canSee, signedUrl, Collections.emptyList());
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
