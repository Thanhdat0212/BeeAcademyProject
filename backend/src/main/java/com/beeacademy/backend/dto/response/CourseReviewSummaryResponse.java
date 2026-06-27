package com.beeacademy.backend.dto.response;

import java.util.List;

public record CourseReviewSummaryResponse(
        double averageRating,
        long reviewCount,
        CourseReviewResponse myReview,
        List<CourseReviewResponse> reviews
) {
}
