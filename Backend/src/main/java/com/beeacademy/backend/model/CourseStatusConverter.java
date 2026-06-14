package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Chuyển đổi giữa Java enum {@link CourseStatus} (PUBLISHED) và
 * chuỗi Postgres lowercase (published).
 *
 * Dùng cùng {@code @ColumnTransformer(write="?::course_status")} trên field
 * để Postgres nhận đúng native enum type thay vì varchar.
 */
@Converter
public class CourseStatusConverter implements AttributeConverter<CourseStatus, String> {

    @Override
    public String convertToDatabaseColumn(CourseStatus status) {
        return status != null ? status.toDbValue() : null;
    }

    @Override
    public CourseStatus convertToEntityAttribute(String dbValue) {
        return CourseStatus.fromDbValue(dbValue);
    }
}
