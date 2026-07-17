package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentLearningContextResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentLearningContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/student/courses/{courseId}")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentLearningContextController {

    private final StudentLearningContextService learningContextService;

    @GetMapping("/learning-context")
    public ApiResponse<StudentLearningContextResponse> getLearningContext(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(
                learningContextService.getLearningContext(courseId, CurrentUser.required()));
    }
}
