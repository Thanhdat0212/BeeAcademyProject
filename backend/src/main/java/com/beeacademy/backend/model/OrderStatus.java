package com.beeacademy.backend.model;

import java.util.Arrays;

public enum OrderStatus {
    PENDING,
    PAID,
    CANCELLED,
    EXPIRED;

    public String toDbValue() {
        return name().toLowerCase();
    }

    public static OrderStatus fromDbValue(String value) {
        if (value == null) return null;
        return Arrays.stream(values())
                .filter(s -> s.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown order_status: " + value));
    }
}
