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
        Integer durationSec,
        Integer position,
        Boolean isFree,
        List<DocumentDto> documents
) {

    /** Tài liệu đính kèm (PDF/slide) — public URL truy cập trực tiếp. */
    public record DocumentDto(String name, String fileUrl, String fileType, Long fileSizeBytes) {
        public static DocumentDto fromEntity(CourseDocument d) {
            return new DocumentDto(d.getName(), d.getFileUrl(), d.getFileType(), d.getFileSizeBytes());
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

        List<DocumentDto> docDtos = (docs != null && !docs.isEmpty())
                ? docs.stream().map(DocumentDto::fromEntity).toList()
                : Collections.emptyList();

        return new LessonResponse(
                lesson.getId(),
                lesson.getTitle(),
                videoUrl,
                embedUrl,
                lesson.getDurationSec(),
                lesson.getPosition(),
                lesson.getIsFree(),
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
