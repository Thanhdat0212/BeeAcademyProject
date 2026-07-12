package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record CompleteCourseProgressItemRequest(
        @NotNull UUID itemId,
        @NotNull @Pattern(regexp = "lesson|quiz") String itemType
) {
}
