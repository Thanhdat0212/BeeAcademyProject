package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ReorderItemRequest(
        @NotNull UUID id,
        @NotNull @Min(1) Integer position
) {}
