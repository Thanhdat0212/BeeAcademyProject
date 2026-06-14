package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.QuizConfigRequest;
import com.beeacademy.backend.dto.request.SubmitQuizRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.QuizAttemptStartResponse;
import com.beeacademy.backend.dto.response.QuizConfigResponse;
import com.beeacademy.backend.dto.response.QuizResultResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.QuizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller cho Quiz (Phase 5–6).
 *
 * <p>GV cấu hình quiz qua /api/teacher/chapters/{id}/quiz-config.
 * Student làm quiz qua /api/student/chapters/{id}/quiz/*.
 */
@RestController
@RequiredArgsConstructor
public class QuizController {

    private final QuizService quizService;

    // ── Teacher: cấu hình quiz ────────────────────────────────────────────────

    @GetMapping("/api/teacher/chapters/{chapterId}/quiz-config")
    @PreAuthorize("hasRole('teacher')")
    public ApiResponse<QuizConfigResponse> getConfig(@PathVariable UUID chapterId) {
        return ApiResponse.ok(quizService.getConfig(chapterId));
    }

    @PutMapping("/api/teacher/chapters/{chapterId}/quiz-config")
    @PreAuthorize("hasRole('teacher')")
    public ApiResponse<QuizConfigResponse> saveConfig(
            @PathVariable UUID chapterId,
            @Valid @RequestBody QuizConfigRequest req) {
        return ApiResponse.ok(
                quizService.saveConfig(chapterId, CurrentUser.required(), req),
                "Đã lưu cấu hình quiz");
    }

    // ── Student: làm quiz ─────────────────────────────────────────────────────

    /** Bắt đầu một lượt làm quiz — trả câu hỏi (đã ẩn đáp án đúng). */
    @PostMapping("/api/student/chapters/{chapterId}/quiz/start")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<QuizAttemptStartResponse> startQuiz(@PathVariable UUID chapterId) {
        return ApiResponse.ok(
                quizService.startAttempt(chapterId, CurrentUser.required()),
                "Bắt đầu làm quiz");
    }

    /** Nộp bài và nhận kết quả ngay. */
    @PostMapping("/api/student/quiz/{attemptId}/submit")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<QuizResultResponse> submitQuiz(
            @PathVariable UUID attemptId,
            @Valid @RequestBody SubmitQuizRequest req) {
        return ApiResponse.ok(
                quizService.submitAttempt(attemptId, CurrentUser.required(), req),
                "Nộp bài thành công");
    }

    /** Xem lại kết quả bài đã làm. */
    @GetMapping("/api/student/quiz/{attemptId}/result")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<QuizResultResponse> getResult(@PathVariable UUID attemptId) {
        return ApiResponse.ok(quizService.getResult(attemptId, CurrentUser.required()));
    }
}
