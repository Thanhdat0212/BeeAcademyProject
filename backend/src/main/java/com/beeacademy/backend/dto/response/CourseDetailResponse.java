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
        String objective,
        String audience,
        String thumbnailUrl,
        String introVideoUrl,
        String categoryName,
        String categorySlug,
        String teacherName,
        List<Integer> grades,
        Integer priceVnd,
        Integer salePriceVnd,
        Integer effectivePriceVnd,
        boolean isOnSale,
        boolean hasFreePreview,
        double averageRating,
        long reviewCount,
        int studentCount,
        Integer totalChapters,
        Integer totalLessons,
        Integer totalDurationSec,
        Integer versionNo,
        Integer submittedVersionNo,
        Instant publishedAt,
        List<ChapterResponse> chapters,
        /** true nếu user đã mua/enroll hoặc là GV sở hữu hoặc là Admin */
        boolean enrolled
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
                course.getObjective(),
                course.getAudience(),
                course.getThumbnailUrl(),
                course.getIntroVideoUrl(),
                categoryName,
                categorySlug,
                teacherName,
                grades,
                course.getPriceVnd(),
                course.getSalePriceVnd(),
                course.getEffectivePriceVnd(),
                course.isOnSale(),
                chapters.stream().anyMatch(ch -> ch.lessons().stream().anyMatch(lesson -> Boolean.TRUE.equals(lesson.isFree()))),
                0.0,
                0,
                0,
                course.getTotalChapters(),
                course.getTotalLessons(),
                course.getTotalDurationSec(),
                course.getVersionNo(),
                course.getSubmittedVersionNo(),
                course.getPublishedAt(),
                chapters,
                canSeeAllVideos   // enrolled = có quyền xem toàn bộ video
        );
    }

    public CourseDetailResponse withRating(double averageRating, long reviewCount) {
        return new CourseDetailResponse(
                id,
                slug,
                title,
                description,
                objective,
                audience,
                thumbnailUrl,
                introVideoUrl,
                categoryName,
                categorySlug,
                teacherName,
                grades,
                priceVnd,
                salePriceVnd,
                effectivePriceVnd,
                isOnSale,
                hasFreePreview,
                averageRating,
                reviewCount,
                studentCount,
                totalChapters,
                totalLessons,
                totalDurationSec,
                versionNo,
                submittedVersionNo,
                publishedAt,
                chapters,
                enrolled
        );
    }

    // studentCount: feature riêng của local (team3 đã bỏ field này) — đếm số học viên đã ghi danh.
    public CourseDetailResponse withStudentCount(int studentCount) {
        return new CourseDetailResponse(
                id,
                slug,
                title,
                description,
                objective,
                audience,
                thumbnailUrl,
                introVideoUrl,
                categoryName,
                categorySlug,
                teacherName,
                grades,
                priceVnd,
                salePriceVnd,
                effectivePriceVnd,
                isOnSale,
                hasFreePreview,
                averageRating,
                reviewCount,
                studentCount,
                totalChapters,
                totalLessons,
                totalDurationSec,
                versionNo,
                submittedVersionNo,
                publishedAt,
                chapters,
                enrolled
        );
    }
}
