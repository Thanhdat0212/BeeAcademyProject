package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class PayoutStatusConverter implements AttributeConverter<PayoutStatus, String> {

    @Override
    public String convertToDatabaseColumn(PayoutStatus status) {
        return status != null ? status.toDbValue() : null;
    }

    @Override
    public PayoutStatus convertToEntityAttribute(String dbValue) {
        if (dbValue == null) return null;
        return PayoutStatus.valueOf(dbValue.toUpperCase());
    }
}
