package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Course;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Response chi tiết khoá học (UC07) - kèm danh sách chapters & lessons.
 *
 * <p>Khác {@link CourseSummaryResponse}: thêm {@code chapters} (đầy đủ
 * curriculum). Service phải fetch chapters + lessons trước khi map.
 *
 * <p>Trường {@code canSeeAllVideos} quyết định lesson nào lộ URL:
 * <ul>
 *   <li>Guest hoặc user chưa mua: chỉ thấy URL các lesson {@code isFree=true}.</li>
 *   <li>User đã mua (có enrollment): thấy URL tất cả lesson.</li>
 * </ul>
 */
public record CourseDetailResponse(
        UUID id,
        String slug,
        String title,
        String description,
        String thumbnailUrl,
        String categoryName,
        String categorySlug,
        String teacherName,
        List<Integer> grades,
        Integer priceVnd,
        Integer salePriceVnd,
        Integer effectivePriceVnd,
        boolean isOnSale,
        Integer totalChapters,
        Integer totalLessons,
        Integer totalDurationSec,
        Instant publishedAt,
        List<ChapterResponse> chapters
) {

    /**
     * @param course           entity đã fetch sẵn category + teacher + chapters + lessons
     * @param canSeeAllVideos  true nếu user là chủ khoá / đã enrolled
     */
    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos) {
        List<Integer> grades = Arrays.stream(course.getGrades()).boxed().collect(Collectors.toList());

        List<ChapterResponse> chapters = course.getChapters().stream()
                .map(c -> ChapterResponse.fromEntity(c, canSeeAllVideos))
                .toList();

        String categoryName = course.getCategory() != null ? course.getCategory().getName() : null;
        String categorySlug = course.getCategory() != null ? course.getCategory().getSlug() : null;
        String teacherName  = course.getTeacher()  != null ? course.getTeacher().getFullName() : null;

        return new CourseDetailResponse(
                course.getId(),
                course.getSlug(),
                course.getTitle(),
                course.getDescription(),
                course.getThumbnailUrl(),
                categoryName,
                categorySlug,
                teacherName,
                grades,
                course.getPriceVnd(),
                course.getSalePriceVnd(),
                course.getEffectivePriceVnd(),
                course.isOnSale(),
                course.getTotalChapters(),
                course.getTotalLessons(),
                course.getTotalDurationSec(),
                course.getPublishedAt(),
                chapters
        );
    }
}
