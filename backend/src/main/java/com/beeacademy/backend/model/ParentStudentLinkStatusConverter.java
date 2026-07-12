package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class ParentStudentLinkStatusConverter implements AttributeConverter<ParentStudentLinkStatus, String> {
    @Override
    public String convertToDatabaseColumn(ParentStudentLinkStatus attribute) {
        return attribute == null ? ParentStudentLinkStatus.ACCEPTED.toDbValue() : attribute.toDbValue();
    }

    @Override
    public ParentStudentLinkStatus convertToEntityAttribute(String dbData) {
        return ParentStudentLinkStatus.fromDbValue(dbData);
    }
}
