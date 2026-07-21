package com.beeacademy.backend.dto.response;

/**
 * Vé upload dùng một lần: client PUT thẳng nội dung file lên {@code uploadUrl},
 * rồi gọi endpoint confirm kèm {@code storagePath} để backend ghi nhận.
 */
public record SignedUploadResponse(
        String uploadUrl,
        String storagePath
) {}
