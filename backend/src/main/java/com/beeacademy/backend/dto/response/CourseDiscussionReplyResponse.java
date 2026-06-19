package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseDiscussionReply;

import java.time.Instant;
import java.util.UUID;

public record CourseDiscussionReplyResponse(
        UUID id,
        UUID authorId,
        String authorName,
        String authorRole,
        String authorAvatarUrl,
        String content,
        Instant createdAt
) {
    public static CourseDiscussionReplyResponse fromEntity(CourseDiscussionReply reply) {
        return new CourseDiscussionReplyResponse(
                reply.getId(),
                reply.getAuthor().getId(),
                displayName(reply.getAuthor().getFullName(), reply.getAuthor().getRole().toDbValue()),
                reply.getAuthor().getRole().toDbValue(),
                reply.getAuthor().getAvatarUrl(),
                reply.getContent(),
                reply.getCreatedAt()
        );
    }

    static String displayName(String fullName, String role) {
        if (fullName != null && !fullName.isBlank()) {
            return fullName;
        }
        return "teacher".equals(role) ? "Giáo viên" : "Học viên";
    }
}
