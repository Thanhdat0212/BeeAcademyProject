package com.beeacademy.backend.model;

public enum ParentStudentLinkStatus {
    PENDING("pending"),
    ACTIVE("active"),
    REJECTED("rejected"),
    EXPIRED("expired"),
    REVOKED("revoked");

    private final String dbValue;

    ParentStudentLinkStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String toDbValue() {
        return dbValue;
    }

    public String toApiValue() {
        return dbValue;
    }

    public static ParentStudentLinkStatus fromDbValue(String value) {
        if (value == null) {
            return ACTIVE;
        }

        String normalizedValue = value.trim();
        // Compatibility for deployments that stored the pre-SRS status name.
        if ("accepted".equalsIgnoreCase(normalizedValue)) {
            return ACTIVE;
        }
        for (ParentStudentLinkStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(normalizedValue)
                    || status.toApiValue().equalsIgnoreCase(normalizedValue)) {
                return status;
            }
        }

        throw new IllegalArgumentException("Unknown parent-student link status: " + value);
    }
}
