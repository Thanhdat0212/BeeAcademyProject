package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Dữ liệu tạo khóa học mới (GV).
 * Khóa học được tạo ở trạng thái DRAFT.
 */
public record CreateCourseRequest(

        @NotBlank(message = "Tiêu đề không được trống")
        @Size(max = 200, message = "Tiêu đề tối đa 200 ký tự")
        String title,

        @Size(max = 5000, message = "Mô tả tối đa 5000 ký tự")
        String description,

        @Size(max = 1000, message = "URL ảnh bìa tối đa 1000 ký tự")
        String thumbnailUrl,

        @NotNull(message = "Vui lòng chọn danh mục môn học")
        UUID categoryId,

        @NotNull(message = "Vui lòng chọn ít nhất một lớp")
        @Size(min = 1, max = 4, message = "Chọn từ 1 đến 4 lớp")
        List<Integer> grades,

        @NotNull(message = "Vui lòng nhập giá khóa học")
        @Min(value = 1000, message = "Giá tối thiểu 1,000 VND")
        Integer priceVnd,

        Integer salePriceVnd   // null = không giảm giá
) {}
