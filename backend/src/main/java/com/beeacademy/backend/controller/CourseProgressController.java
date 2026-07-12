package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CourseProgressResponse;
import com.beeacademy.backend.dto.response.StudentLearningProgressResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CourseProgressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CourseProgressController {

    private final CourseProgressService progressService;

    @GetMapping({"/api/me/progress", "/api/student/progress"})
    public ApiResponse<StudentLearningProgressResponse> getLearningProgress() {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(progressService.getLearningProgress(me));
    }

    @GetMapping("/api/courses/{courseId}/progress")
    public ApiResponse<CourseProgressResponse> getProgress(@PathVariable UUID courseId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(progressService.getProgress(courseId, me));
    }

    @PostMapping("/api/courses/{courseId}/progress/complete")
    public ApiResponse<CourseProgressResponse> completeItem(
            @PathVariable UUID courseId,
            @Valid @RequestBody CompleteCourseProgressItemRequest request
    ) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(progressService.completeItem(courseId, me, request), "Đã lưu tiến độ học tập");
    }
}
