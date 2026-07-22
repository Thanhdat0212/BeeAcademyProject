package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.Instant;

/** Partial update of the UC16 submission policy. */
public record UpdateAssignmentPolicyRequest(
        Instant dueAt,

        @Min(value = 1, message = "Số lần nộp tối đa phải từ 1")
        Integer maxAttempts,

        Boolean allowLateSubmission,

        @Min(value = 0, message = "Mức trừ điểm nộp muộn không được âm")
        @Max(value = 100, message = "Mức trừ điểm nộp muộn không vượt quá 100%")
        Integer latePenaltyPercent,

        Boolean acceptingSubmissions
) {
}
