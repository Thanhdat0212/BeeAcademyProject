package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.GradeAssignmentSubmissionRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.AssignmentSubmissionResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AssignmentService;
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

@RestController
@RequestMapping("/api/teacher/assignment-submissions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class AssignmentController {

    private final AssignmentService assignmentService;

    @GetMapping
    public ApiResponse<List<AssignmentSubmissionResponse>> listSubmissions() {
        return ApiResponse.ok(
                assignmentService.listTeacherSubmissions(CurrentUser.required()));
    }

    @PutMapping("/{submissionId}/grade")
    public ApiResponse<AssignmentSubmissionResponse> gradeSubmission(
            @PathVariable UUID submissionId,
            @Valid @RequestBody GradeAssignmentSubmissionRequest request) {
        return ApiResponse.ok(
                assignmentService.gradeSubmission(
                        submissionId, CurrentUser.required(), request),
                "Đã lưu điểm bài tự luận");
    }
}
