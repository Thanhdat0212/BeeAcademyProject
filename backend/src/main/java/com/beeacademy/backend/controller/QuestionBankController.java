package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.dto.request.UpdateQuestionBankStatusRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.QuestionBankResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.QuestionBankService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

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
                "Created question bank");
    }

    @PutMapping("/{questionBankId}")
    public ApiResponse<QuestionBankResponse> updateQuestionBank(
            @PathVariable UUID questionBankId,
            @Valid @RequestBody CreateQuestionBankRequest req) {
        return ApiResponse.ok(
                questionBankService.updateQuestionBank(CurrentUser.required(), questionBankId, req),
                "Updated question bank");
    }

    @PatchMapping("/{questionBankId}/status")
    public ApiResponse<QuestionBankResponse> updateQuestionBankStatus(
            @PathVariable UUID questionBankId,
            @Valid @RequestBody UpdateQuestionBankStatusRequest req) {
        return ApiResponse.ok(
                questionBankService.updateStatus(CurrentUser.required(), questionBankId, req.active()),
                "Updated question bank status");
    }
}
