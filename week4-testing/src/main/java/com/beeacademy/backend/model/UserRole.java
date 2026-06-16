package com.beeacademy.backend.model;

import java.util.Arrays;

public enum UserRole {
    STUDENT, PARENT, TEACHER, ADMIN;

    public String toDbValue() {
        return name().toLowerCase();
    }

    public static UserRole fromDbValue(String value) {
        if (value == null) return null;
        return Arrays.stream(values())
                .filter(r -> r.name().equalsIgnoreCase(value))
                .findFirst().orElse(null);
    }

    public boolean isAllowedForPublicSignup() {
        return this == STUDENT || this == PARENT || this == TEACHER;
    }
}
