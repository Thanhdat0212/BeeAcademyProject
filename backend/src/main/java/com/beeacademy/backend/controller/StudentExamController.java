package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SubmitExamRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentExamResultResponse;
import com.beeacademy.backend.dto.response.StudentExamStartResponse;
import com.beeacademy.backend.dto.response.StudentExamSummaryResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class StudentExamController {

    private final ExamService examService;

    @GetMapping("/api/student/courses/{courseId}/exams")
    public ApiResponse<List<StudentExamSummaryResponse>> listExams(@PathVariable UUID courseId) {
        return ApiResponse.ok(examService.listStudentExams(courseId, CurrentUser.required()));
    }

    @PostMapping("/api/student/courses/{courseId}/exams/{slotIndex}/start")
    public ApiResponse<StudentExamStartResponse> startExam(@PathVariable UUID courseId,
                                                           @PathVariable Integer slotIndex) {
        return ApiResponse.ok(
                examService.startStudentExam(courseId, slotIndex, CurrentUser.required()),
                "Started exam");
    }

    @PostMapping("/api/student/exam-attempts/{attemptId}/submit")
    public ApiResponse<StudentExamResultResponse> submitExam(@PathVariable UUID attemptId,
                                                             @Valid @RequestBody SubmitExamRequest req) {
        return ApiResponse.ok(
                examService.submitStudentExam(attemptId, CurrentUser.required(), req),
                "Submitted exam");
    }
}
