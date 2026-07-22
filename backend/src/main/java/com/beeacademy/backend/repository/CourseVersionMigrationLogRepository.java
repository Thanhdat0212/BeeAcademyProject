package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseVersionMigrationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CourseVersionMigrationLogRepository
        extends JpaRepository<CourseVersionMigrationLog, UUID> {

    List<CourseVersionMigrationLog> findByEnrollmentIdOrderByCreatedAtDesc(UUID enrollmentId);
}
