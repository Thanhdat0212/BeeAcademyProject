package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Chapter;

import java.util.List;
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
        List<TeacherLessonResponse> lessons = c.getLessons().stream()
                .map(TeacherLessonResponse::fromEntity)
                .toList();
        return new TeacherChapterResponse(
                c.getId(), c.getTitle(), c.getDescription(), c.getPosition(), lessons
        );
    }
}
