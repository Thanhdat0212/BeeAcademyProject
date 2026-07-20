package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CourseVersionMigrationRequest(
        @NotNull UUID targetCourseVersionId,
        @NotEmpty List<UUID> studentIds,
        @NotNull Map<UUID, UUID> progressItemMapping,
        @NotEmpty Map<UUID, UUID> finalExamMapping,
        @NotBlank @Size(max = 1000) String certificateMapping,
        @NotBlank @Size(max = 1000) String reason
) {
}
