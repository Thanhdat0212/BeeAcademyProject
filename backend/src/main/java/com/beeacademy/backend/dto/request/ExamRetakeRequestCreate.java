package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExamRetakeRequestCreate(
        @NotBlank(message = "Vui lòng nhập lý do xin mở thêm lượt")
        @Size(min = 10, max = 1000, message = "Lý do cần từ 10 đến 1000 ký tự")
        String reason
) {
}
