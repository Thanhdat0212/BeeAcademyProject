package com.beeacademy.backend.model;

public enum TeacherApprovalStatus {
    PENDING("pending"),
    APPROVED("approved"),
    REJECTED("rejected");

    private final String dbValue;

    TeacherApprovalStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String toDbValue() {
        return dbValue;
    }

    public static TeacherApprovalStatus fromDbValue(String value) {
        if (value == null || value.isBlank()) {
            return APPROVED;
        }
        for (TeacherApprovalStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(value) || status.name().equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown teacher approval status: " + value);
    }
}
