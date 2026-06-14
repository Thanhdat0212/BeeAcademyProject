package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateQaMessageRequest;
import com.beeacademy.backend.dto.request.CreateQaThreadRequest;
import com.beeacademy.backend.dto.request.UpdateQaThreadStatusRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.QaThreadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.QaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class QaController {

    private final QaService qaService;

    @GetMapping("/student/qa")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<List<QaThreadResponse>> listStudentThreads() {
        return ApiResponse.ok(qaService.listStudentThreads(CurrentUser.required()));
    }

    @PostMapping("/student/qa")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<QaThreadResponse> createStudentThread(
            @Valid @RequestBody CreateQaThreadRequest req) {
        return ApiResponse.ok(
                qaService.createStudentThread(CurrentUser.required(), req),
                "Đã gửi câu hỏi tới giáo viên");
    }

    @PostMapping("/student/qa/{threadId}/messages")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<QaThreadResponse> addStudentMessage(
            @PathVariable UUID threadId,
            @Valid @RequestBody CreateQaMessageRequest req) {
        return ApiResponse.ok(
                qaService.addStudentMessage(threadId, CurrentUser.required(), req),
                "Đã gửi phản hồi");
    }

    @GetMapping("/teacher/qa")
    @PreAuthorize("hasRole('teacher')")
    public ApiResponse<List<QaThreadResponse>> listTeacherThreads() {
        return ApiResponse.ok(qaService.listTeacherThreads(CurrentUser.required()));
    }

    @PostMapping("/teacher/qa/{threadId}/messages")
    @PreAuthorize("hasRole('teacher')")
    public ApiResponse<QaThreadResponse> addTeacherMessage(
            @PathVariable UUID threadId,
            @Valid @RequestBody CreateQaMessageRequest req) {
        return ApiResponse.ok(
                qaService.addTeacherMessage(threadId, CurrentUser.required(), req),
                "Đã gửi câu trả lời");
    }

    @PutMapping("/teacher/qa/{threadId}/status")
    @PreAuthorize("hasRole('teacher')")
    public ApiResponse<QaThreadResponse> updateTeacherStatus(
            @PathVariable UUID threadId,
            @Valid @RequestBody UpdateQaThreadStatusRequest req) {
        return ApiResponse.ok(
                qaService.updateTeacherStatus(threadId, CurrentUser.required(), req.resolved()),
                req.resolved() ? "Đã đánh dấu câu hỏi đã giải quyết" : "Đã mở lại câu hỏi");
    }
}
