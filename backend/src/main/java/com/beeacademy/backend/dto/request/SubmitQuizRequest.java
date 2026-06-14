package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

/**
 * Học sinh nộp bài quiz.
 * answers: {questionId → choiceId} — null value = câu bỏ trống.
 */
public record SubmitQuizRequest(

        @NotNull(message = "Thiếu danh sách câu trả lời")
        Map<UUID, UUID> answers   // nullable value cho phép bỏ trống câu
) {}
