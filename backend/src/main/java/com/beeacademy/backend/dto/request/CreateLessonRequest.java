package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Tạo bài giảng mới trong một chương. */
public record CreateLessonRequest(

        @NotBlank(message = "Tiêu đề bài giảng không được trống")
        @Size(max = 200)
        String title,

        @Size(max = 500)
        String description,

        @Min(1)
        Integer position,    // null = thêm vào cuối

        boolean isFree,      // cho xem thử miễn phí?

        /** URL nhúng YouTube/Vimeo — nullable, dùng khi videoSource = 'embed'. */
        String videoEmbedUrl,

        /** upload | embed | none — FE gửi để backend biết intent khi lưu. */
        String videoSource
) {}
