package com.beeacademy.backend.model;

public enum QaThreadStatus {
    PENDING("pending"),
    ANSWERED("answered"),
    RESOLVED("resolved");

    private final String dbValue;

    QaThreadStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String toDbValue() {
        return dbValue;
    }

    public static QaThreadStatus fromDbValue(String value) {
        if (value == null) return PENDING;
        for (QaThreadStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(value)) return status;
        }
        throw new IllegalArgumentException("Unknown QA thread status: " + value);
    }
}
