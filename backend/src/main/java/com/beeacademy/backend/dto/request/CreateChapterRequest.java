package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Tạo chương mới trong một khóa học. */
public record CreateChapterRequest(

        @NotBlank(message = "Tiêu đề chương không được trống")
        @Size(max = 200)
        String title,

        @Size(max = 1000)
        String description,

        @Min(1)
        Integer position   // null = thêm vào cuối
) {}
