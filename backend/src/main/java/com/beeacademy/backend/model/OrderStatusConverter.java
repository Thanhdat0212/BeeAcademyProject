package com.beeacademy.backend.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class OrderStatusConverter implements AttributeConverter<OrderStatus, String> {

    @Override
    public String convertToDatabaseColumn(OrderStatus status) {
        return status != null ? status.toDbValue() : null;
    }

    @Override
    public OrderStatus convertToEntityAttribute(String dbValue) {
        return OrderStatus.fromDbValue(dbValue);
    }
}
