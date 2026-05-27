package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Category;

import java.util.UUID;

/**
 * DTO trả về cho danh mục môn học - dùng trong dropdown filter ở frontend.
 *
 * @param id           UUID danh mục
 * @param slug         URL-friendly (vd: "toan-hoc")
 * @param name         Tên hiển thị (vd: "Toán học")
 * @param icon         Emoji/URL icon, có thể null
 * @param displayOrder Thứ tự hiển thị
 */
public record CategoryResponse(
        UUID id,
        String slug,
        String name,
        String icon,
        Integer displayOrder
) {

    public static CategoryResponse fromEntity(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getSlug(),
                category.getName(),
                category.getIcon(),
                category.getDisplayOrder()
        );
    }
}
