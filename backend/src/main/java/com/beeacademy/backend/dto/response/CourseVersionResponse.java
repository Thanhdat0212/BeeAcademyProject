package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseVersion;

import java.time.Instant;
import java.util.UUID;

public record CourseVersionResponse(
        UUID id,
        Integer versionNo,
        String title,
        String submittedByName,
        Instant submittedAt
) {
    public static CourseVersionResponse fromEntity(CourseVersion version) {
        return new CourseVersionResponse(
                version.getId(),
                version.getVersionNo(),
                version.getTitle(),
                version.getSubmittedBy() != null
                        ? version.getSubmittedBy().getFullName()
                        : null,
                version.getSubmittedAt()
        );
    }
}
