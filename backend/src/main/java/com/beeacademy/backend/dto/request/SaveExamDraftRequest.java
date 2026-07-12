package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record SaveExamDraftRequest(
        @NotNull(message = "Thieu danh sach cau tra loi")
        Map<String, SubmitExamRequest.ExamAnswerRequest> answers
) {
}
