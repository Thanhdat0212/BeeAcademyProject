package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateComplaintRequest(
        @NotBlank(message = "Vui lòng nhập tiêu đề")
        @Size(max = 200, message = "Tiêu đề tối đa 200 ký tự")
        String title,

        @NotBlank(message = "Vui lòng chọn loại khiếu nại")
        @Pattern(regexp = "payment|course_review|bank_verify|student_report|content|technical|other",
                 message = "Loại khiếu nại không hợp lệ")
        String category,

        @Pattern(regexp = "low|medium|high", message = "Mức ưu tiên không hợp lệ")
        String priority,

        @NotBlank(message = "Vui lòng nhập nội dung khiếu nại")
        @Size(max = 5000, message = "Nội dung tối đa 5000 ký tự")
        String content
) {
    /** Mức ưu tiên mặc định khi client không gửi. */
    public String priorityOrDefault() {
        return (priority == null || priority.isBlank()) ? "medium" : priority;
    }
}
