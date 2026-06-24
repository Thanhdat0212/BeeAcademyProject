package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Cập nhật thông tin cơ bản khóa học (GV). Mọi field đều optional — null = giữ nguyên. */
public record UpdateCourseRequest(

        @Size(max = 200) String title,
        @Size(max = 5000) String description,
        @Size(max = 5000) String objective,
        @Size(max = 5000) String audience,
        @Size(max = 1000) String thumbnailUrl,
        @Size(max = 1000) String introVideoUrl,
        UUID categoryId,
        List<Integer> grades,
        @Min(1000) Integer priceVnd,
        Integer salePriceVnd
) {}
