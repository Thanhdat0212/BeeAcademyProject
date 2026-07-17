package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.AiExamGradeResponse;
import com.beeacademy.backend.dto.response.AiQuizAnalysisResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AiGradingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * AI chấm/nhận xét sơ bộ bài làm cho học sinh (trước khi giáo viên chấm chính thức).
 * Gọi Gemini một lần rồi lưu — POST tính toán, GET trả bản đã lưu.
 */
@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class AiGradingController {

    private final AiGradingService aiGradingService;

    @PostMapping("/exam-attempts/{attemptId}/ai-grade")
    public ApiResponse<AiExamGradeResponse> gradeExam(@PathVariable UUID attemptId) {
        return ApiResponse.ok(
                aiGradingService.gradeExamAttempt(attemptId, CurrentUser.required()),
                "AI đã chấm sơ bộ bài kiểm tra");
    }

    @GetMapping("/exam-attempts/{attemptId}/ai-grade")
    public ApiResponse<AiExamGradeResponse> getExamGrade(@PathVariable UUID attemptId) {
        return ApiResponse.ok(aiGradingService.getExamGrade(attemptId, CurrentUser.required()));
    }

    @PostMapping("/quiz/{attemptId}/ai-analysis")
    public ApiResponse<AiQuizAnalysisResponse> analyzeQuiz(@PathVariable UUID attemptId) {
        return ApiResponse.ok(
                aiGradingService.analyzeQuizAttempt(attemptId, CurrentUser.required()),
                "AI đã phân tích bài quiz");
    }

    @GetMapping("/quiz/{attemptId}/ai-analysis")
    public ApiResponse<AiQuizAnalysisResponse> getQuizAnalysis(@PathVariable UUID attemptId) {
        return ApiResponse.ok(aiGradingService.getQuizAnalysis(attemptId, CurrentUser.required()));
    }
}
