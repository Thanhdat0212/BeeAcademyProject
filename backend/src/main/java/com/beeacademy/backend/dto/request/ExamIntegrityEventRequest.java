package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ExamIntegrityEventRequest(
        @NotNull(message = "Thiếu mã sự kiện chống gian lận")
        UUID eventId,

        @NotBlank(message = "Thiếu loại sự kiện chống gian lận")
        @Size(max = 32, message = "Loại sự kiện chống gian lận không hợp lệ")
        String eventType
) {
}
