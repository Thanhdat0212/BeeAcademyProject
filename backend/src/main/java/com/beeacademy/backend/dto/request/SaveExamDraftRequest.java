package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record SaveExamDraftRequest(
        @NotNull(message = "Thiếu danh sách câu trả lời")
        Map<String, SubmitExamRequest.ExamAnswerRequest> answers
) {
}
