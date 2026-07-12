package com.beeacademy.backend.dto.response;

import java.time.Instant;

public record SystemSettingsResponse(
        boolean maintenanceMode,
        int platformFeePercent,
        Instant updatedAt,
        Instant maintenanceUntil
) {
}
