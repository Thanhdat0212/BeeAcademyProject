package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.CourseVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CourseVersionRepository extends JpaRepository<CourseVersion, UUID> {

    @Query("SELECT COALESCE(MAX(v.versionNo), 0) FROM CourseVersion v WHERE v.course.id = :courseId")
    int findMaxVersionNo(@Param("courseId") UUID courseId);

    List<CourseVersion> findByCourseIdOrderByVersionNoDesc(UUID courseId);
}
