package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record MarkQaThreadDuplicateRequest(
        @NotNull UUID duplicateOfThreadId
) {
}
