package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class ComplaintStatusConverter implements AttributeConverter<ComplaintStatus, String> {
    @Override
    public String convertToDatabaseColumn(ComplaintStatus attribute) {
        return attribute == null ? ComplaintStatus.PENDING.toDbValue() : attribute.toDbValue();
    }

    @Override
    public ComplaintStatus convertToEntityAttribute(String dbData) {
        return ComplaintStatus.fromDbValue(dbData);
    }
}
