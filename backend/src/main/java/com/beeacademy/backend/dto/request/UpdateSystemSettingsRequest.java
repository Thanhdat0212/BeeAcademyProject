package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateSystemSettingsRequest(
        @NotNull Boolean maintenanceMode,
        @NotNull @Min(0) @Max(100) Integer platformFeePercent
) {
}
