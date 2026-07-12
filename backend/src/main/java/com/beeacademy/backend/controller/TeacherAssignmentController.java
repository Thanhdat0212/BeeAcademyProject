package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateAssignmentRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.TeacherAssignmentResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/assignments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class TeacherAssignmentController {

    private final AssignmentService assignmentService;

    @GetMapping
    public ApiResponse<List<TeacherAssignmentResponse>> listAssignments() {
        return ApiResponse.ok(
                assignmentService.listTeacherAssignments(CurrentUser.required()));
    }

    @PostMapping
    public ApiResponse<TeacherAssignmentResponse> createAssignment(
            @Valid @RequestBody CreateAssignmentRequest request) {
        return ApiResponse.ok(
                assignmentService.createAssignment(CurrentUser.required(), request),
                "Đã tạo bài tập");
    }

    @DeleteMapping("/{assignmentId}")
    public ApiResponse<Void> deleteAssignment(@PathVariable UUID assignmentId) {
        assignmentService.deleteAssignment(assignmentId, CurrentUser.required());
        return ApiResponse.ok(null, "Đã xóa bài tập");
    }
}
