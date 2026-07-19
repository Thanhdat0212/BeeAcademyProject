package com.beeacademy.backend.dto.response;

import java.time.Instant;

/**
 * URL xem thử tài liệu bài học cho Admin khi duyệt khóa học (UC36).
 *
 * <p>Khác với {@link DocumentDownloadResponse} của học sinh: không watermark,
 * không one-time token — admin là nhân sự tin cậy, chỉ cần signed URL ngắn hạn.
 */
public record AdminDocumentUrlResponse(
        String url,          // signed URL (private bucket) hoặc public URL (bản ghi legacy)
        Instant expiresAt    // null nếu là public URL legacy không hết hạn
) {}
