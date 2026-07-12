package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ModerateCourseReviewRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CourseReviewResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CourseReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Admin moderation for reviews flagged by the UC19 content filter. */
@RestController
@RequestMapping("/api/admin/course-reviews")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminCourseReviewController {

    private final CourseReviewService courseReviewService;

    @GetMapping("/pending")
    public ApiResponse<List<CourseReviewResponse>> pending() {
        return ApiResponse.ok(courseReviewService.getPendingModerationReviews(CurrentUser.required()));
    }

    @PutMapping("/{reviewId}/moderation")
    public ApiResponse<CourseReviewResponse> moderate(
            @PathVariable UUID reviewId,
            @Valid @RequestBody ModerateCourseReviewRequest request) {
        return ApiResponse.ok(courseReviewService.moderateReview(
                reviewId, CurrentUser.required(), request));
    }
}
