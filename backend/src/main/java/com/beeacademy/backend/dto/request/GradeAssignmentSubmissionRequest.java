package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record GradeAssignmentSubmissionRequest(
        @NotNull(message = "Điểm không được để trống")
        @DecimalMin(value = "0.0", message = "Điểm không được âm")
        Double score,

        @Size(max = 3000, message = "Nhận xét tối đa 3000 ký tự")
        String feedback,

        @Size(max = 1000, message = "Ly do sua diem toi da 1000 ky tu")
        String revisionReason
) {
    public GradeAssignmentSubmissionRequest(Double score, String feedback) {
        this(score, feedback, null);
    }
}
