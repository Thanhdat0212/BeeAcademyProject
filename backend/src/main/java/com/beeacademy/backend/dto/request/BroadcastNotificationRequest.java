package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BroadcastNotificationRequest(
        /** "ALL", "STUDENT", "TEACHER" hoặc "PARENT" — không cho gửi tới ADMIN qua kênh này. */
        @NotBlank(message = "Vui lòng chọn đối tượng nhận")
        String targetRole,

        @NotBlank(message = "Vui lòng nhập tiêu đề")
        @Size(max = 180, message = "Tiêu đề tối đa 180 ký tự")
        String title,

        @NotBlank(message = "Vui lòng nhập nội dung")
        @Size(max = 2000, message = "Nội dung tối đa 2000 ký tự")
        String body,

        @Size(max = 500, message = "Đường dẫn tối đa 500 ký tự")
        String targetUrl
) {
}
