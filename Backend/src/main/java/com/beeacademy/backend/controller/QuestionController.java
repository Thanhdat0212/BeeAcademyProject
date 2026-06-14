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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST controller cho Ngân hàng câu hỏi (Phase 4 — UC29).
 * Tất cả endpoint yêu cầu role = teacher.
 */
@Validated   // bật method-level validation để @Valid cascade vào List elements
@RestController
@RequestMapping("/api/teacher/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class QuestionController {

    private final QuestionService questionService;

    /** Tạo câu hỏi mới. */
    @PostMapping
    public ApiResponse<QuestionResponse> createQuestion(
            @Valid @RequestBody CreateQuestionRequest req) {
        return ApiResponse.ok(
                questionService.createQuestion(CurrentUser.required(), req),
                "Thêm câu hỏi vào ngân hàng thành công");
    }

    /**
     * Danh sách câu hỏi của GV với filter tùy chọn.
     * Query params: chapterId, difficulty (easy/medium/hard), status (active/inactive)
     */
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

    /** Chi tiết một câu hỏi. */
    @GetMapping("/{questionId}")
    public ApiResponse<QuestionResponse> getQuestion(@PathVariable UUID questionId) {
        return ApiResponse.ok(
                questionService.getQuestion(questionId, CurrentUser.required()));
    }

    /** Cập nhật câu hỏi (rebuild toàn bộ choices). */
    @PutMapping("/{questionId}")
    public ApiResponse<QuestionResponse> updateQuestion(
            @PathVariable UUID questionId,
            @Valid @RequestBody CreateQuestionRequest req) {
        return ApiResponse.ok(
                questionService.updateQuestion(questionId, CurrentUser.required(), req));
    }

    /** Xóa câu hỏi (soft-delete nếu đã được dùng). */
    @DeleteMapping("/{questionId}")
    public ApiResponse<Void> deleteQuestion(@PathVariable UUID questionId) {
        questionService.deleteQuestion(questionId, CurrentUser.required());
        return ApiResponse.ok(null, "Đã xóa câu hỏi");
    }

    /** Nhập hàng loạt từ Excel/AI parse — tối đa 200 câu mỗi lần. */
    @PostMapping("/bulk")
    public ApiResponse<QuestionService.BulkImportResult> bulkCreate(
            @RequestBody List<CreateQuestionRequest> requests) {
        return ApiResponse.ok(
                questionService.bulkCreateQuestions(CurrentUser.required(), requests),
                "Nhập hàng loạt hoàn tất");
    }

    /** Thống kê ngân hàng câu hỏi theo chương (để hiển thị trên trang cấu hình quiz). */
    @GetMapping("/stats/{chapterId}")
    public ApiResponse<QuestionStatsResponse> getStats(@PathVariable UUID chapterId) {
        return ApiResponse.ok(questionService.getStatsForChapter(CurrentUser.required(), chapterId));
    }
}
