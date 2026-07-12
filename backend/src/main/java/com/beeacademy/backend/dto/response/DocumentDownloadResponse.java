package com.beeacademy.backend.dto.response;

import java.time.Instant;

public record DocumentDownloadResponse(
        String downloadUrl,
        Instant expiresAt,
        boolean watermarked,
        boolean oneTime
) {
}
