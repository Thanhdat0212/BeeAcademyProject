package com.beeacademy.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderLessonsRequest(
        @NotEmpty List<@Valid ReorderItemRequest> lessons
) {}
