package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateCourseDiscussionThreadRequest(
        UUID lessonId,

        @NotBlank(message = "Vui lòng nhập nội dung câu hỏi")
        @Size(max = 5000, message = "Câu hỏi tối đa 5000 ký tự")
        String content,

        @Size(max = 1000) String attachmentUrl,
        @Size(max = 255) String attachmentName,
        @Size(max = 100) String attachmentType,
        Long attachmentSizeBytes
) {
}
