package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.CourseDocument;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Thông tin chương học phía GV — kèm danh sách bài giảng. */
public record TeacherChapterResponse(
        UUID id,
        String title,
        String description,
        Integer position,
        List<TeacherLessonResponse> lessons
) {
    public static TeacherChapterResponse fromEntity(Chapter c) {
        return fromEntity(c, Collections.emptyMap());
    }

    public static TeacherChapterResponse fromEntity(
            Chapter c, Map<UUID, List<CourseDocument>> documentsByLessonId) {
        List<TeacherLessonResponse> lessons = c.getLessons().stream()
                .map(lesson -> TeacherLessonResponse.fromEntity(
                        lesson,
                        documentsByLessonId.getOrDefault(lesson.getId(), Collections.emptyList())))
                .toList();
        return new TeacherChapterResponse(
                c.getId(), c.getTitle(), c.getDescription(), c.getPosition(), lessons
        );
    }
}
