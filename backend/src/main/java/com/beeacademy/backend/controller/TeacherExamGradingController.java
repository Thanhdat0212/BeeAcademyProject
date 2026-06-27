package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.GradeExamAttemptRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.TeacherExamAttemptResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ExamService;
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
@RequestMapping("/api/teacher/exam-attempts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class TeacherExamGradingController {

    private final ExamService examService;

    @GetMapping
    public ApiResponse<List<TeacherExamAttemptResponse>> listAttempts() {
        return ApiResponse.ok(examService.listTeacherExamAttempts(CurrentUser.required()));
    }

    @PutMapping("/{attemptId}/grade")
    public ApiResponse<TeacherExamAttemptResponse> gradeAttempt(
            @PathVariable UUID attemptId,
            @Valid @RequestBody GradeExamAttemptRequest request) {
        return ApiResponse.ok(
                examService.gradeExamAttempt(attemptId, CurrentUser.required(), request),
                "Đã lưu điểm bài kiểm tra");
    }
}
