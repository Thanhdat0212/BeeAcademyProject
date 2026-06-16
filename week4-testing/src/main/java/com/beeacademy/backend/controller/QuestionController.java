package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateQuestionRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.QuestionResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.QuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/teacher/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping
    public ApiResponse<QuestionResponse> createQuestion(@Valid @RequestBody CreateQuestionRequest req) {
        return ApiResponse.ok(
                questionService.createQuestion(CurrentUser.required(), req),
                "Thêm câu hỏi vào ngân hàng thành công");
    }

    @GetMapping
    public ApiResponse<PageResponse<QuestionResponse>> listQuestions(
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) Integer grade,
            @RequestParam(required = false) UUID chapterId,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(questionService.listQuestions(
                CurrentUser.required(), categoryId, grade, chapterId, difficulty, status, pageable));
    }

    @GetMapping("/{questionId}")
    public ApiResponse<QuestionResponse> getQuestion(@PathVariable UUID questionId) {
        return ApiResponse.ok(questionService.getQuestion(questionId, CurrentUser.required()));
    }

    @PutMapping("/{questionId}")
    public ApiResponse<QuestionResponse> updateQuestion(
            @PathVariable UUID questionId, @Valid @RequestBody CreateQuestionRequest req) {
        return ApiResponse.ok(questionService.updateQuestion(questionId, CurrentUser.required(), req));
    }

    @DeleteMapping("/{questionId}")
    public ApiResponse<Void> deleteQuestion(@PathVariable UUID questionId) {
        questionService.deleteQuestion(questionId, CurrentUser.required());
        return ApiResponse.ok(null, "Đã xóa câu hỏi");
    }

    @PostMapping("/bulk")
    public ApiResponse<QuestionService.BulkImportResult> bulkCreate(
            @RequestBody List<CreateQuestionRequest> requests) {
        return ApiResponse.ok(questionService.bulkCreateQuestions(CurrentUser.required(), requests),
                "Nhập hàng loạt hoàn tất");
    }

    @GetMapping("/stats/{chapterId}")
    public ApiResponse<QuestionStatsResponse> getStats(@PathVariable UUID chapterId) {
        return ApiResponse.ok(questionService.getStatsForChapter(CurrentUser.required(), chapterId));
    }
}
