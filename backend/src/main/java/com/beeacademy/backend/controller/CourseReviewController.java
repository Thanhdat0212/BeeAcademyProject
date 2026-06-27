package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.UpsertCourseReviewRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CourseReviewResponse;
import com.beeacademy.backend.dto.response.CourseReviewSummaryResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CourseReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/courses/{courseId}/reviews")
@RequiredArgsConstructor
public class CourseReviewController {

    private final CourseReviewService courseReviewService;

    @GetMapping
    public ApiResponse<CourseReviewSummaryResponse> getReviews(@PathVariable UUID courseId) {
        return ApiResponse.ok(courseReviewService.getCourseReviews(courseId, CurrentUser.optional()));
    }

    @PostMapping
    @PreAuthorize("hasRole('student')")
    public ApiResponse<CourseReviewResponse> upsertReview(
            @PathVariable UUID courseId,
            @Valid @RequestBody UpsertCourseReviewRequest request
    ) {
        return ApiResponse.ok(
                courseReviewService.upsertCourseReview(courseId, CurrentUser.required(), request),
                "Đã lưu đánh giá khóa học"
        );
    }
}
