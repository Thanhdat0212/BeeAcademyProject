package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BankReviewRequest(
        @NotNull Boolean approve,
        @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
        String note
) {
}
