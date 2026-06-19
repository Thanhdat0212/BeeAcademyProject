package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCourseDiscussionReplyRequest(
        @NotBlank(message = "Vui lòng nhập nội dung phản hồi")
        @Size(max = 5000, message = "Phản hồi tối đa 5000 ký tự")
        String content
) {
}
