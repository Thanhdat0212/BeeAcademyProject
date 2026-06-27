package com.beeacademy.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderChaptersRequest(
        @NotEmpty List<@Valid ReorderItemRequest> chapters
) {}
