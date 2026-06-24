package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ApprovalHistory;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseVersion;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Chi tiết khóa học đầy đủ phía GV — kèm chapters, lessons và lịch sử duyệt.
 * Dùng cho trang chỉnh sửa /teacher/courses/:id.
 */
public record TeacherCourseDetailResponse(
        UUID id,
        String slug,
        String title,
        String description,
        String objective,
        String audience,
        String thumbnailUrl,
        String introVideoUrl,
        UUID categoryId,
        String categoryName,
        List<Integer> grades,
        Integer priceVnd,
        Integer salePriceVnd,
        String status,
        Integer totalChapters,
        Integer totalLessons,
        Integer salesCount,
        Integer versionNo,
        Integer submittedVersionNo,
        Instant publishedAt,
        Instant createdAt,
        List<TeacherChapterResponse> chapters,
        List<ApprovalHistoryResponse> approvalHistory,
        List<CourseVersionResponse> versions
) {
    public static TeacherCourseDetailResponse fromEntity(Course c,
                                                          List<ApprovalHistory> history) {
        return fromEntity(c, history, 0);
    }

    public static TeacherCourseDetailResponse fromEntity(Course c,
                                                          List<ApprovalHistory> history,
                                                          int salesCount) {
        return fromEntity(c, history, salesCount, c.getChapters());
    }

    public static TeacherCourseDetailResponse fromEntity(Course c,
                                                          List<ApprovalHistory> history,
                                                          int salesCount,
                                                          List<Chapter> chapterEntities) {
        return fromEntity(c, history, salesCount, chapterEntities, List.of());
    }

    public static TeacherCourseDetailResponse fromEntity(Course c,
                                                          List<ApprovalHistory> history,
                                                          int salesCount,
                                                          List<Chapter> chapterEntities,
                                                          List<CourseVersion> versionEntities) {
        List<TeacherChapterResponse> chapters = chapterEntities.stream()
                .map(TeacherChapterResponse::fromEntity)
                .toList();
        int totalChapters = chapters.size();
        int totalLessons = chapters.stream()
                .mapToInt(ch -> ch.lessons() != null ? ch.lessons().size() : 0)
                .sum();
        List<ApprovalHistoryResponse> historyDtos = history.stream()
                .map(ApprovalHistoryResponse::fromEntity)
                .toList();
        List<CourseVersionResponse> versionDtos = versionEntities.stream()
                .map(CourseVersionResponse::fromEntity)
                .toList();
        return new TeacherCourseDetailResponse(
                c.getId(), c.getSlug(), c.getTitle(), c.getDescription(),
                c.getObjective(), c.getAudience(),
                c.getThumbnailUrl(), c.getIntroVideoUrl(),
                c.getCategory() != null ? c.getCategory().getId() : null,
                c.getCategory() != null ? c.getCategory().getName() : null,
                Arrays.stream(c.getGrades()).boxed().collect(Collectors.toList()),
                c.getPriceVnd(), c.getSalePriceVnd(),
                c.getStatus().toDbValue(),
                totalChapters, totalLessons,
                salesCount, c.getVersionNo(), c.getSubmittedVersionNo(),
                c.getPublishedAt(), c.getCreatedAt(), chapters, historyDtos, versionDtos
        );
    }
}
