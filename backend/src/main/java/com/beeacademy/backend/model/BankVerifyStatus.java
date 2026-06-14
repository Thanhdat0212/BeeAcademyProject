package com.beeacademy.backend.model;

public enum BankVerifyStatus {
    PENDING, VERIFIED, REJECTED;

    public String toDbValue() {
        return name().toLowerCase();
    }
}
