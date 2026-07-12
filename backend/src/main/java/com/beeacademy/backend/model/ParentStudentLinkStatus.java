package com.beeacademy.backend.model;

public enum ParentStudentLinkStatus {
    PENDING("pending"),
    ACCEPTED("active"),
    REJECTED("revoked");

    private final String dbValue;

    ParentStudentLinkStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String toDbValue() {
        return dbValue;
    }

    public String toApiValue() {
        return switch (this) {
            case PENDING -> "pending";
            case ACCEPTED -> "accepted";
            case REJECTED -> "rejected";
        };
    }

    public static ParentStudentLinkStatus fromDbValue(String value) {
        if (value == null) {
            return ACCEPTED;
        }

        String normalizedValue = value.trim();
        for (ParentStudentLinkStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(normalizedValue)
                    || status.toApiValue().equalsIgnoreCase(normalizedValue)) {
                return status;
            }
        }

        throw new IllegalArgumentException("Unknown parent-student link status: " + value);
    }
}
