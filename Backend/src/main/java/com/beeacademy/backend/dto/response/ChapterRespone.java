package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Chapter;

import java.util.List;
import java.util.UUID;

/**
 * Chapter + danh sách lesson lồng bên trong.
 *
 * <p>Mặc dù entity có quan hệ 2 chiều (chapter ↔ lessons), DTO chỉ
 * giữ chiều xuống → tự nhiên cho frontend render accordion.
 *
 * @param id          UUID chapter
 * @param title       tiêu đề chương
 * @param description mô tả (nullable)
 * @param position    thứ tự trong khoá
 * @param lessons     danh sách bài học
 */
public record ChapterResponse(
        UUID id,
        String title,
        String description,
        Integer position,
        List<LessonResponse> lessons
) {

    /**
     * Map entity → DTO.
     *
     * @param chapter    entity chapter (lessons phải đã được fetch)
     * @param canSeeAllVideos true nếu user có quyền xem mọi video (đã mua khoá)
     */
    public static ChapterResponse fromEntity(Chapter chapter, boolean canSeeAllVideos) {
        List<LessonResponse> lessons = chapter.getLessons().stream()
                // includeUrl = true nếu user đã mua HOẶC lesson được free
                .map(l -> LessonResponse.fromEntity(l, canSeeAllVideos || Boolean.TRUE.equals(l.getIsFree())))
                .toList();
        return new ChapterResponse(
                chapter.getId(),
                chapter.getTitle(),
                chapter.getDescription(),
                chapter.getPosition(),
                lessons
        );
    }
}
