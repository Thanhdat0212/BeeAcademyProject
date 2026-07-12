package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.StudentLessonNote;

import java.time.Instant;
import java.util.UUID;

public record StudentLessonNoteResponse(
        UUID id,
        UUID lessonId,
        int timeSec,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
    public static StudentLessonNoteResponse fromEntity(StudentLessonNote note) {
        return new StudentLessonNoteResponse(
                note.getId(),
                note.getLesson().getId(),
                note.getTimeSec(),
                note.getContent(),
                note.getCreatedAt(),
                note.getUpdatedAt()
        );
    }
}
