package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QaThread;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record QaThreadResponse(
        UUID id,
        UUID studentId,
        String studentName,
        UUID courseId,
        String courseTitle,
        UUID lessonId,
        String lessonTitle,
        String status,
        Instant createdAt,
        Instant lastActivityAt,
        List<QaMessageResponse> messages
) {
    public static QaThreadResponse fromEntity(QaThread thread) {
        String studentName = thread.getStudent().getFullName();
        if (studentName == null || studentName.isBlank()) {
            studentName = "Học sinh";
        }
        List<QaMessageResponse> messages = thread.getMessages().stream()
                .sorted(Comparator.comparing(m -> m.getCreatedAt() == null ? Instant.EPOCH : m.getCreatedAt()))
                .map(QaMessageResponse::fromEntity)
                .toList();
        return new QaThreadResponse(
                thread.getId(),
                thread.getStudent().getId(),
                studentName,
                thread.getCourse().getId(),
                thread.getCourse().getTitle(),
                thread.getLesson() != null ? thread.getLesson().getId() : null,
                thread.getLesson() != null ? thread.getLesson().getTitle() : null,
                thread.getStatus().toDbValue(),
                thread.getCreatedAt(),
                thread.getLastActivityAt(),
                messages
        );
    }
}
