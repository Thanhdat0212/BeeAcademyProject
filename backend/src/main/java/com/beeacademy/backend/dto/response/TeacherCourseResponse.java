package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Course;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Thông tin khóa học trong danh sách của GV — không kèm chapters.
 * Dùng cho trang /teacher/courses (list view) và /teacher/content (dropdown chọn khóa).
 *
 * <p>Thêm {@code categoryId} để frontend có thể:
 * <ul>
 *   <li>Form edit không cần gọi getCourseDetail() thêm lần nữa chỉ để lấy categoryId.</li>
 *   <li>QuestionFormPanel filter/lock category khi chọn khóa học liên kết câu hỏi.</li>
 * </ul>
 */
public record TeacherCourseResponse(
        UUID id,
        String slug,
        String title,
        String thumbnailUrl,
        UUID   categoryId,      // FIX: thêm để form edit không cần thêm 1 API call
        String categoryName,
        List<Integer> grades,
        Integer priceVnd,
        Integer salePriceVnd,
        String status,          // draft | pending_review | approved | rejected | needs_revision | published
        Integer totalChapters,
        Integer totalLessons,
        Integer salesCount,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static TeacherCourseResponse fromEntity(Course c) {
        return fromEntity(c, 0);
    }

    public static TeacherCourseResponse fromEntity(Course c, int salesCount) {
        return fromEntity(c, salesCount, c.getTotalChapters(), c.getTotalLessons());
    }

    public static TeacherCourseResponse fromEntity(Course c, int salesCount,
                                                   int totalChapters, int totalLessons) {
        return new TeacherCourseResponse(
                c.getId(), c.getSlug(), c.getTitle(), c.getThumbnailUrl(),
                c.getCategory() != null ? c.getCategory().getId()   : null,
                c.getCategory() != null ? c.getCategory().getName() : null,
                Arrays.stream(c.getGrades()).boxed().collect(Collectors.toList()),
                c.getPriceVnd(), c.getSalePriceVnd(),
                c.getStatus().toDbValue(),
                totalChapters, totalLessons, salesCount,
                c.getPublishedAt(),
                c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
