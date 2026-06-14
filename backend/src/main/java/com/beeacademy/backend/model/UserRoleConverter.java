package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Chuyển đổi giữa Java enum {@link UserRole} (STUDENT) và
 * chuỗi Postgres lowercase (student).
 *
 * Dùng cùng {@code @ColumnTransformer(write="?::user_role")} trên field
 * để Postgres nhận đúng native enum type thay vì varchar.
 */
@Converter
public class UserRoleConverter implements AttributeConverter<UserRole, String> {

    @Override
    public String convertToDatabaseColumn(UserRole role) {
        return role != null ? role.toDbValue() : null;
    }

    @Override
    public UserRole convertToEntityAttribute(String dbValue) {
        return UserRole.fromDbValue(dbValue);
    }
}
