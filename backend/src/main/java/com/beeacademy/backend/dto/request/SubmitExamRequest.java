package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record SubmitExamRequest(
        @NotNull(message = "Thiếu danh sách câu trả lời")
        Map<String, List<Integer>> answers
) {}
