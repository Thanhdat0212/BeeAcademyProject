package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseReview;
import com.beeacademy.backend.model.CourseReviewModerationStatus;

import java.time.Instant;
import java.util.UUID;

public record CourseReviewResponse(
        UUID id,
        UUID courseId,
        UUID studentId,
        String studentName,
        String studentAvatarUrl,
        int rating,
        String comment,
        CourseReviewModerationStatus moderationStatus,
        Instant createdAt,
        Instant updatedAt
) {

    public static CourseReviewResponse fromEntity(CourseReview review) {
        return new CourseReviewResponse(
                review.getId(),
                review.getCourse().getId(),
                review.getStudent().getId(),
                review.getStudent().getFullName(),
                review.getStudent().getAvatarUrl(),
                review.getRating(),
                review.getComment(),
                review.getModerationStatus(),
                review.getCreatedAt(),
                review.getUpdatedAt()
        );
    }
}
