package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateParentSensitiveDataConsentRequest(
        @NotNull Boolean consentGranted
) {
}
