package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Course;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public record PendingCourseResponse(
        UUID id,
        String title,
        String thumbnailUrl,
        String teacherName,
        String categoryName,
        List<Integer> grades,
        Integer priceVnd,
        Integer salePriceVnd,
        Integer totalChapters,
        Integer totalLessons,
        Instant submittedAt
) {
    public static PendingCourseResponse fromEntity(Course c) {
        return new PendingCourseResponse(
                c.getId(), c.getTitle(), c.getThumbnailUrl(),
                c.getTeacher() != null ? c.getTeacher().getFullName() : null,
                c.getCategory() != null ? c.getCategory().getName() : null,
                c.getGrades() != null
                        ? Arrays.stream(c.getGrades()).boxed().toList()
                        : Collections.emptyList(),
                c.getPriceVnd(), c.getSalePriceVnd(),
                c.getTotalChapters(), c.getTotalLessons(),
                c.getUpdatedAt()
        );
    }
}
