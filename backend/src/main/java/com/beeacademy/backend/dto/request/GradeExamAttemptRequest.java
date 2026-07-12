package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record GradeExamAttemptRequest(
        @NotNull(message = "Điểm không được để trống")
        @DecimalMin(value = "0.0", message = "Điểm phải từ 0 đến 100")
        @DecimalMax(value = "100.0", message = "Điểm phải từ 0 đến 100")
        Double scorePercent,

        @Size(max = 2000, message = "Nhận xét tối đa 2000 ký tự")
        String feedback
) {
}
