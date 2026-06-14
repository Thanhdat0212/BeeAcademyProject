package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class BankVerifyStatusConverter implements AttributeConverter<BankVerifyStatus, String> {

    @Override
    public String convertToDatabaseColumn(BankVerifyStatus status) {
        return status != null ? status.toDbValue() : null;
    }

    @Override
    public BankVerifyStatus convertToEntityAttribute(String dbValue) {
        if (dbValue == null) return null;
        return BankVerifyStatus.valueOf(dbValue.toUpperCase());
    }
}
