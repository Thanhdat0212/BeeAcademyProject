package com.beeacademy.backend.model;

import java.util.Arrays;

public enum CourseStatus {
    DRAFT, PENDING_REVIEW, APPROVED, REJECTED, NEEDS_REVISION, PUBLISHED, ARCHIVED;

    public boolean isPubliclyVisible() { return this == PUBLISHED; }

    public String toDbValue() { return name().toLowerCase(); }

    public static CourseStatus fromDbValue(String value) {
        if (value == null) return null;
        return Arrays.stream(values())
                .filter(s -> s.name().equalsIgnoreCase(value))
                .findFirst().orElse(null);
    }
}
