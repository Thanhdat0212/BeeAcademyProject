package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Client báo đã upload xong một file không gắn với bài giảng (vd: video giới thiệu). */
public record ConfirmUploadRequest(
        @NotBlank String storagePath
) {}
