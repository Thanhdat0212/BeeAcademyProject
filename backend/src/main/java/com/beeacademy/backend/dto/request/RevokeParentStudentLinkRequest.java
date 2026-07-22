package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RevokeParentStudentLinkRequest(
        @NotNull(message = "Mã thao tác hủy liên kết là bắt buộc.")
        UUID operationId,

        @Size(max = 500, message = "Lý do hủy liên kết không được vượt quá 500 ký tự.")
        String reason
) {
}
