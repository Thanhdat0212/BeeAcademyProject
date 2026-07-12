package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.QuestionBankResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.QuestionBankService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teacher/question-banks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class QuestionBankController {

    private final QuestionBankService questionBankService;

    @GetMapping
    public ApiResponse<List<QuestionBankResponse>> listQuestionBanks() {
        return ApiResponse.ok(questionBankService.listQuestionBanks(CurrentUser.required()));
    }

    @PostMapping
    public ApiResponse<QuestionBankResponse> createQuestionBank(
            @Valid @RequestBody CreateQuestionBankRequest req) {
        return ApiResponse.ok(
                questionBankService.createQuestionBank(CurrentUser.required(), req),
                "Tạo ngân hàng câu hỏi thành công");
    }
}
