package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ComplaintAttachment;

import java.util.UUID;
import java.util.function.Function;

/** File đính kèm của một tin nhắn khiếu nại — {@code url} là signed URL tạm thời. */
public record ComplaintAttachmentResponse(
        UUID id,
        String fileName,
        String contentType,
        Long sizeBytes,
        String url
) {
    public static ComplaintAttachmentResponse fromEntity(ComplaintAttachment a,
                                                         Function<String, String> urlResolver) {
        return new ComplaintAttachmentResponse(
                a.getId(),
                a.getFileName(),
                a.getContentType(),
                a.getSizeBytes(),
                urlResolver.apply(a.getStoragePath())
        );
    }
}
