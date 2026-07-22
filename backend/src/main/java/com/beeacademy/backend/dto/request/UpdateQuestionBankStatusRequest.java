package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateQuestionBankStatusRequest(
        @NotNull(message = "Trạng thái ngân hàng câu hỏi không được trống")
        Boolean active
) {
}
