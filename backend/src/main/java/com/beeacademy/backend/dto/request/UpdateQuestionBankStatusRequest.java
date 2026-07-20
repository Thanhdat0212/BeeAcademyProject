package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateQuestionBankStatusRequest(
        @NotNull(message = "Trang thai ngan hang cau hoi khong duoc trong")
        Boolean active
) {
}
