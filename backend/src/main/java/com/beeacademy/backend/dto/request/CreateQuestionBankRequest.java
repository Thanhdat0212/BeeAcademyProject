package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateQuestionBankRequest(

        @NotBlank(message = "Tên ngân hàng không được trống")
        @Size(max = 255, message = "Tên ngân hàng tối đa 255 ký tự")
        String title,

        @NotNull(message = "Vui lòng chọn lĩnh vực / môn học")
        UUID categoryId,

        @NotNull(message = "Vui lòng chọn lớp")
        Integer grade,

        @Size(max = 2000, message = "Mô tả tối đa 2000 ký tự")
        String description
) {
}
