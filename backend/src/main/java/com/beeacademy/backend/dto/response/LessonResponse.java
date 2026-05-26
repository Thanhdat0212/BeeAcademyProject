package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Lesson;

import java.util.UUID;

/**
 * Bài học gọn nhẹ - dùng trong curriculum accordion ở trang chi tiết khoá.
 *
 * <p>Quy tắc giấu video:
 * <ul>
 *   <li>Lesson {@code isFree=true} → trả {@code videoUrl} đầy đủ (UC08
 *       cho guest xem thử).</li>
 *   <li>Lesson {@code isFree=false} → service sẽ truyền {@code includeUrl=false}
 *       khi user chưa enrolled; URL trả về null. Khi user đã mua khoá thì
 *       trả URL đầy đủ.</li>
 * </ul>
 *
 * <p>Logic quyết định {@code includeUrl} nằm ở {@code CourseService}, DTO
 * chỉ là cấu trúc dữ liệu.
 *
 * @param id          UUID bài học
 * @param title       tiêu đề
 * @param videoUrl    URL video (null nếu bị giấu)
 * @param durationSec thời lượng (giây)
 * @param position    thứ tự trong chapter
 * @param isFree      có cho xem thử miễn phí không
 */
public record LessonResponse(
        UUID id,
        String title,
        String videoUrl,
        Integer durationSec,
        Integer position,
        Boolean isFree
) {

    /**
     * Map từ entity. {@code includeUrl} quyết định có expose video URL hay không.
     *
     * @param lesson     entity
     * @param includeUrl true = user có quyền xem (đã mua hoặc lesson free)
     */
    public static LessonResponse fromEntity(Lesson lesson, boolean includeUrl) {
        return new LessonResponse(
                lesson.getId(),
                lesson.getTitle(),
                includeUrl ? lesson.getVideoUrl() : null,
                lesson.getDurationSec(),
                lesson.getPosition(),
                lesson.getIsFree()
        );
    }
}
