package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ExamRetakeDecisionRequest(
        @NotNull Boolean approve,
        Integer extraAttempts,
        @NotBlank(message = "Vui lòng nhập lý do quyết định")
        @Size(max = 1000, message = "Lý do tối đa 1000 ký tự")
        String reason
) {
}
