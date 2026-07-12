package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Size;

import java.util.List;

public record SubmitAssignmentRequest(
        @Size(max = 20000, message = "Nội dung bài làm tối đa 20000 ký tự")
        String content,

        @Size(max = 5, message = "Tối đa 5 file đính kèm")
        List<SubmissionFile> files
) {
    public record SubmissionFile(
            String name,
            String url,
            String type,
            Long sizeBytes
    ) {
    }
}
