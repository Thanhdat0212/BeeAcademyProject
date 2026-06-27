package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** Cập nhật bài giảng. Mọi field đều optional. */
public record UpdateLessonRequest(
        @Size(max = 200) String title,
        @Size(max = 500)  String description,
        @Min(1) Integer position,
        Boolean isFree,
        String videoEmbedUrl,
        String videoSource
) {}
