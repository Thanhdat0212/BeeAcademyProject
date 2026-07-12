package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ExamRetakeDecisionRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ExamRetakeRequestResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ExamRetakeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Duyệt yêu cầu mở thêm lượt làm bài kiểm tra (BRULE-RETAKE-001).
 * GV thấy yêu cầu thuộc khóa của mình; Admin thấy tất cả.
 */
@RestController
@RequestMapping("/api/teacher/retake-requests")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('teacher', 'admin')")
public class TeacherRetakeRequestController {

    private final ExamRetakeService examRetakeService;

    @GetMapping
    public ApiResponse<List<ExamRetakeRequestResponse>> listPending() {
        return ApiResponse.ok(examRetakeService.listPendingForReviewer(CurrentUser.required()));
    }

    @PatchMapping("/{requestId}/decide")
    public ApiResponse<ExamRetakeRequestResponse> decide(
            @PathVariable UUID requestId,
            @Valid @RequestBody ExamRetakeDecisionRequest request) {
        ExamRetakeRequestResponse decided =
                examRetakeService.decide(requestId, CurrentUser.required(), request);
        return ApiResponse.ok(decided,
                "APPROVED".equals(decided.status())
                        ? "Đã duyệt mở thêm lượt làm bài"
                        : "Đã từ chối yêu cầu mở thêm lượt");
    }
}
