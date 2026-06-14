package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class QaThreadStatusConverter implements AttributeConverter<QaThreadStatus, String> {
    @Override
    public String convertToDatabaseColumn(QaThreadStatus attribute) {
        return attribute == null ? QaThreadStatus.PENDING.toDbValue() : attribute.toDbValue();
    }

    @Override
    public QaThreadStatus convertToEntityAttribute(String dbData) {
        return QaThreadStatus.fromDbValue(dbData);
    }
}
