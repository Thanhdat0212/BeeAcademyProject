package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

public record ChapterResponse(
        UUID id,
        String title,
        String description,
        Integer position,
        List<LessonResponse> lessons,
        /** true nếu chương đã có quiz config — frontend dùng để ẩn/hiện nút "Làm quiz". */
        boolean hasQuizConfig
) {

    public static ChapterResponse fromEntity(Chapter chapter, boolean canSeeAllVideos) {
        return fromEntity(chapter, canSeeAllVideos, null, Collections.emptyMap(), false);
    }

    public static ChapterResponse fromEntity(Chapter chapter, boolean canSeeAllVideos,
                                              Function<Lesson, String> resolver) {
        return fromEntity(chapter, canSeeAllVideos, resolver, Collections.emptyMap(), false);
    }

    /** Overload đầy đủ: signed URL + docMap + hasQuizConfig. */
    public static ChapterResponse fromEntity(Chapter chapter, boolean canSeeAllVideos,
                                              Function<Lesson, String> resolver,
                                              Map<UUID, List<CourseDocument>> docMap,
                                              boolean hasQuizConfig) {
        List<LessonResponse> lessons = chapter.getLessons().stream()
                .map(l -> {
                    boolean canSee = canSeeAllVideos || Boolean.TRUE.equals(l.getIsFree());
                    String signedUrl = (canSee && resolver != null && l.getVideoStoragePath() != null)
                            ? resolver.apply(l) : null;
                    List<CourseDocument> docs = docMap.getOrDefault(l.getId(), Collections.emptyList());
                    return LessonResponse.fromEntity(l, canSeeAllVideos, signedUrl, docs);
                })
                .toList();
        return new ChapterResponse(
                chapter.getId(),
                chapter.getTitle(),
                chapter.getDescription(),
                chapter.getPosition(),
                lessons,
                hasQuizConfig
        );
    }
}
