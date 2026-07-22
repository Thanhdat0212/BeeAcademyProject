package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QaThread;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record QaThreadResponse(
        UUID id,
        String title,
        UUID studentId,
        String studentName,
        UUID courseId,
        String courseTitle,
        UUID lessonId,
        String lessonTitle,
        String status,
        String visibility,
        UUID duplicateOfThreadId,
        Instant duplicateMarkedAt,
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
                resolveTitle(thread),
                thread.getStudent().getId(),
                studentName,
                thread.getCourse().getId(),
                thread.getCourse().getTitle(),
                thread.getLesson() != null ? thread.getLesson().getId() : null,
                thread.getLesson() != null ? thread.getLesson().getTitle() : null,
                thread.getStatus().toDbValue(),
                thread.getVisibility(),
                thread.getDuplicateOfThreadId(),
                thread.getDuplicateMarkedAt(),
                thread.getCreatedAt(),
                thread.getLastActivityAt(),
                messages
        );
    }

    private static String resolveTitle(QaThread thread) {
        if (thread.getTitle() != null && !thread.getTitle().isBlank()) {
            return thread.getTitle();
        }
        return thread.getMessages().stream()
                .map(message -> message.getContent())
                .filter(content -> content != null && !content.isBlank())
                .findFirst()
                .map(String::trim)
                .map(content -> content.length() <= 180
                        ? content
                        : content.substring(0, 177) + "...")
                .orElse("Câu hỏi khóa học");
    }
}
