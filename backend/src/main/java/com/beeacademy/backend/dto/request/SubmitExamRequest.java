package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;

public record SubmitExamRequest(
        @NotNull(message = "Thiếu danh sách câu trả lời")
        Map<String, @Valid ExamAnswerRequest> answers
) {
    public record ExamAnswerRequest(
            List<Integer> selectedIndices,
            String textAnswer,
            List<String> imageUrls,
            JsonNode answerData
    ) {}
}
