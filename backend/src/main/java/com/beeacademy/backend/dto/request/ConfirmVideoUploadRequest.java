package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Client báo đã upload xong video lên Storage, xin backend gắn vào bài giảng. */
public record ConfirmVideoUploadRequest(
        @NotBlank String storagePath,
        Integer durationSec
) {}
