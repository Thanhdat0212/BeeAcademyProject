package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ParentTeacherConversationResponse(
        UUID threadId,
        UUID studentId,
        String studentName,
        UUID teacherId,
        String teacherName,
        String teacherAvatarUrl,
        UUID courseId,
        String courseTitle,
        String categoryName,
        String gradeLabel,
        String status,
        Instant startedAt,
        Instant lastActivityAt,
        String lastMessage,
        int messageCount,
        List<QaMessageResponse> messages
) {
}
