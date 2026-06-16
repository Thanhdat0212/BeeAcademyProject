package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

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
