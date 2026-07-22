package com.beeacademy.backend.dto.response;

import java.util.List;
import java.util.UUID;

public record CourseVersionMigrationResponse(
        UUID courseId,
        UUID targetCourseVersionId,
        Integer targetVersionNo,
        Integer migratedEnrollmentCount,
        List<UUID> migratedStudentIds
) {
}
