package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
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
        boolean hasFreePreview,
        Integer totalChapters,
        Integer totalLessons,
        Integer totalDurationSec,
        Instant publishedAt,
        List<ChapterResponse> chapters,
        /** true nếu user đã mua/enroll hoặc là GV sở hữu hoặc là Admin */
        boolean enrolled,
        Integer studentCount,
        Double ratingAvg,
        Integer reviewCount
) {

    /**
     * @param course           entity đã fetch sẵn category + teacher + chapters + lessons
     * @param canSeeAllVideos  true nếu user là chủ khoá / đã enrolled
     */
    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos) {
        return fromEntity(course, canSeeAllVideos, null, Collections.emptyMap(), Collections.emptySet());
    }

    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos,
                                                   Function<Lesson, String> resolver) {
        return fromEntity(course, canSeeAllVideos, resolver, Collections.emptyMap(), Collections.emptySet());
    }

    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos,
                                                   Function<Lesson, String> resolver,
                                                   Map<UUID, List<CourseDocument>> docMap) {
        return fromEntity(course, canSeeAllVideos, resolver, docMap, Collections.emptySet());
    }

    /**
     * Overload đầy đủ: signed URL resolver + docMap + tập chapterId đã có quiz config.
     *
     * @param chaptersWithQuiz chapterId nào đã được GV cấu hình quiz
     *                         — dùng để set {@code hasQuizConfig} trên từng ChapterResponse
     */
    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos,
                                                   Function<Lesson, String> resolver,
                                                   Map<UUID, List<CourseDocument>> docMap,
                                                   Set<UUID> chaptersWithQuiz) {
        return fromEntity(course, canSeeAllVideos, resolver, docMap, chaptersWithQuiz, 0, null, 0);
    }

    /**
     * Overload đầy đủ nhất: kèm số học viên thật ({@code studentCount}) và
     * thống kê đánh giá ({@code ratingAvg}, {@code reviewCount}). {@code ratingAvg}
     * null khi khóa chưa có đánh giá nào.
     */
    public static CourseDetailResponse fromEntity(Course course, boolean canSeeAllVideos,
                                                   Function<Lesson, String> resolver,
                                                   Map<UUID, List<CourseDocument>> docMap,
                                                   Set<UUID> chaptersWithQuiz,
                                                   int studentCount, Double ratingAvg, int reviewCount) {
        List<Integer> grades = Arrays.stream(course.getGrades()).boxed().collect(Collectors.toList());

        List<ChapterResponse> chapters = course.getChapters().stream()
                .map(c -> ChapterResponse.fromEntity(c, canSeeAllVideos, resolver, docMap,
                        chaptersWithQuiz.contains(c.getId())))
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
                chapters.stream().anyMatch(ch -> ch.lessons().stream().anyMatch(lesson -> Boolean.TRUE.equals(lesson.isFree()))),
                course.getTotalChapters(),
                course.getTotalLessons(),
                course.getTotalDurationSec(),
                course.getPublishedAt(),
                chapters,
                canSeeAllVideos,   // enrolled = có quyền xem toàn bộ video
                studentCount,
                ratingAvg,
                reviewCount
        );
    }
}
