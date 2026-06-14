package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Course;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Shape gọn cho khoá học - dùng trong list/grid {@code GET /api/courses}.
 *
 * <p>Cố tình KHÔNG kèm chapters/lessons (sẽ phình response cho 20 khoá học
 * mỗi trang). Frontend muốn xem chi tiết thì gọi
 * {@code GET /api/courses/{id}} để nhận {@link CourseDetailResponse}.
 *
 * @param id              UUID khoá
 * @param slug            URL-friendly
 * @param title           tiêu đề
 * @param description     mô tả ngắn
 * @param thumbnailUrl    ảnh thumbnail
 * @param categoryName    tên danh mục (vd: "Toán học")
 * @param categorySlug    slug danh mục (cho link filter)
 * @param teacherName     họ tên giáo viên
 * @param grades          danh sách lớp [8, 9]
 * @param priceVnd        giá gốc
 * @param salePriceVnd    giá sale, null nếu không giảm
 * @param effectivePriceVnd  giá thực tế phải trả (sale ?? price)
 * @param isOnSale        true nếu đang giảm giá
 * @param isFeatured      true nếu được nổi bật
 * @param totalChapters   tổng số chương
 * @param totalLessons    tổng số bài
 * @param totalDurationSec  tổng thời lượng giây
 */
public record CourseSummaryResponse(
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
        Boolean isFeatured,
        Integer totalChapters,
        Integer totalLessons,
        Integer totalDurationSec
) {

    /**
     * Map từ entity. {@code course.category} và {@code course.teacher} phải
     * đã được fetch (xem {@code CourseRepository.findWithCategoryAndTeacherById}).
     *
     * <p>Để service biết gọi đúng method repository và tránh N+1 query
     * khi map page (nếu list 20 courses thì N=20 → 40 query extra).
     */
    public static CourseSummaryResponse fromEntity(Course course) {
        // Boxing int[] → List<Integer> để JSON ra mảng JSON chuẩn
        List<Integer> grades = Arrays.stream(course.getGrades()).boxed().collect(Collectors.toList());

        String categoryName = course.getCategory() != null ? course.getCategory().getName() : null;
        String categorySlug = course.getCategory() != null ? course.getCategory().getSlug() : null;
        String teacherName  = course.getTeacher()  != null ? course.getTeacher().getFullName() : null;

        return new CourseSummaryResponse(
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
                course.getIsFeatured(),
                course.getTotalChapters(),
                course.getTotalLessons(),
                course.getTotalDurationSec()
        );
    }
}
