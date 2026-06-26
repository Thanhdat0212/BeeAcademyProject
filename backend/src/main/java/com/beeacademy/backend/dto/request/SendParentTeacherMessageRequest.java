package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SendParentTeacherMessageRequest(
        @NotNull(message = "Vui lòng chọn khóa học")
        UUID courseId,

        @NotBlank(message = "Vui lòng nhập nội dung tin nhắn")
        @Size(max = 2000, message = "Tin nhắn tối đa 2000 ký tự")
        String content,

        @Size(max = 1000, message = "Đường dẫn file đính kèm quá dài")
        String attachmentUrl,

        @Size(max = 255, message = "Tên file đính kèm quá dài")
        String attachmentName,

        @Size(max = 100, message = "Loại file đính kèm quá dài")
        String attachmentType,

        Long attachmentSizeBytes
) {
}
