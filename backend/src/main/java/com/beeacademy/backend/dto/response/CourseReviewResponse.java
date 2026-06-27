package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseReview;

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
                review.getCreatedAt(),
                review.getUpdatedAt()
        );
    }
}
