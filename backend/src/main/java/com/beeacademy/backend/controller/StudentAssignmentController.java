package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SubmitAssignmentRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentAssignmentResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AssignmentService;
import com.beeacademy.backend.service.ContentUploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentAssignmentController {

    private final AssignmentService assignmentService;
    private final ContentUploadService uploadService;

    @GetMapping("/courses/{courseId}/assignments")
    public ApiResponse<List<StudentAssignmentResponse>> listAssignments(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(
                assignmentService.listStudentAssignments(courseId, CurrentUser.required()));
    }

    @PostMapping("/assignments/{assignmentId}/submissions")
    public ApiResponse<StudentAssignmentResponse> submitAssignment(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody SubmitAssignmentRequest request) {
        return ApiResponse.ok(
                assignmentService.submitAssignment(
                        assignmentId, CurrentUser.required(), request),
                "Đã nộp bài tập");
    }

    @PostMapping("/assignments/{assignmentId}/files")
    public ApiResponse<UploadResponse> uploadSubmissionFile(
            @PathVariable UUID assignmentId,
            @RequestParam("file") MultipartFile file) {
        UUID studentId = CurrentUser.required().userId();
        assignmentService.verifyCanSubmit(assignmentId, studentId);
        UploadResponse result = uploadService.uploadAssignmentFile(
                assignmentId, studentId, file);
        return ApiResponse.ok(result, "Upload file bài làm thành công");
    }
}
