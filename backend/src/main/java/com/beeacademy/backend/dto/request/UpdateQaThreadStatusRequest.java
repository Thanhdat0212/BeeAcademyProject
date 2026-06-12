package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateQaThreadStatusRequest(
        @NotNull(message = "Vui lòng chọn trạng thái")
        Boolean resolved
) {
}
