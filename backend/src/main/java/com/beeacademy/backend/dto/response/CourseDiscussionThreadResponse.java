package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseDiscussionThread;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record CourseDiscussionThreadResponse(
        UUID id,
        UUID courseId,
        UUID lessonId,
        String lessonTitle,
        UUID authorId,
        String authorName,
        String authorRole,
        String authorAvatarUrl,
        String content,
        Instant createdAt,
        Instant lastActivityAt,
        List<CourseDiscussionReplyResponse> replies
) {
    public static CourseDiscussionThreadResponse fromEntity(CourseDiscussionThread thread) {
        List<CourseDiscussionReplyResponse> replies = thread.getReplies().stream()
                .sorted(Comparator.comparing(r -> r.getCreatedAt() == null ? Instant.EPOCH : r.getCreatedAt()))
                .map(CourseDiscussionReplyResponse::fromEntity)
                .toList();
        String role = thread.getAuthor().getRole().toDbValue();
        return new CourseDiscussionThreadResponse(
                thread.getId(),
                thread.getCourse().getId(),
                thread.getLesson() != null ? thread.getLesson().getId() : null,
                thread.getLesson() != null ? thread.getLesson().getTitle() : null,
                thread.getAuthor().getId(),
                CourseDiscussionReplyResponse.displayName(thread.getAuthor().getFullName(), role),
                role,
                thread.getAuthor().getAvatarUrl(),
                thread.getContent(),
                thread.getCreatedAt(),
                thread.getLastActivityAt(),
                replies
        );
    }
}
