package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SaveStudentVideoProgressRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentVideoProgressResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentVideoProgressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/student/courses/{courseId}")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentVideoProgressController {

    private final StudentVideoProgressService progressService;

    @GetMapping("/video-progress/latest")
    public ApiResponse<StudentVideoProgressResponse> getLatestProgress(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(
                progressService.getLatestProgress(courseId, CurrentUser.required()));
    }

    @GetMapping("/lessons/{lessonId}/video-progress")
    public ApiResponse<StudentVideoProgressResponse> getProgress(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId) {
        return ApiResponse.ok(
                progressService.getProgress(courseId, lessonId, CurrentUser.required()));
    }

    @PutMapping("/lessons/{lessonId}/video-progress")
    public ApiResponse<StudentVideoProgressResponse> saveProgress(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody SaveStudentVideoProgressRequest request) {
        return ApiResponse.ok(
                progressService.saveProgress(courseId, lessonId, CurrentUser.required(), request),
                "Da luu vi tri xem video"
        );
    }
}
