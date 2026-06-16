package com.beeacademy.backend.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String resourceName, Object id) {
        super(
            resourceName.toUpperCase() + "_NOT_FOUND",
            "Không tìm thấy " + resourceName + " với id: " + id,
            HttpStatus.NOT_FOUND
        );
    }
}
