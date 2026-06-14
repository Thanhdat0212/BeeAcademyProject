package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** Cập nhật chương. Mọi field đều optional. */
public record UpdateChapterRequest(
        @Size(max = 200) String title,
        @Size(max = 1000) String description,
        @Min(1) Integer position
) {}
