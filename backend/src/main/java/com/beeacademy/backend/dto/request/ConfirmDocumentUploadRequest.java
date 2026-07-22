package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Client báo đã upload xong tài liệu lên Storage, xin backend lưu metadata. */
public record ConfirmDocumentUploadRequest(
        @NotBlank String storagePath,
        String name,
        String slot
) {}
