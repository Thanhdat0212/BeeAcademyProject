package com.beeacademy.backend.model;

public enum PayoutStatus {
    PENDING, PROCESSING, PAID;

    public String toDbValue() {
        return name().toLowerCase();
    }
}
