package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.AiChatRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AiChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI hỗ trợ học sinh (UC22 chat + UC23 lộ trình học).
 * Key Gemini chỉ ở backend — client không bao giờ gọi Gemini trực tiếp.
 */
@RestController
@RequestMapping("/api/student/ai")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class AiStudentController {

    private final AiChatService aiChatService;

    @PostMapping("/chat")
    public ApiResponse<String> chat(@Valid @RequestBody AiChatRequest request) {
        return ApiResponse.ok(aiChatService.chat(request));
    }

    @GetMapping("/roadmap")
    public ApiResponse<String> roadmap() {
        return ApiResponse.ok(aiChatService.roadmap(CurrentUser.required()));
    }
}
