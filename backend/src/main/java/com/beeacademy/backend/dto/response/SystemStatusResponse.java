package com.beeacademy.backend.dto.response;

import java.time.Instant;

public record SystemStatusResponse(
        boolean maintenanceMode,
        Instant maintenanceUntil
) {
}
