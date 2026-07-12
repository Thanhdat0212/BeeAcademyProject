package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CertificateRepository extends JpaRepository<Certificate, UUID> {

    Optional<Certificate> findByStudentIdAndCourseId(UUID studentId, UUID courseId);

    Optional<Certificate> findByIdAndStudentId(UUID id, UUID studentId);

    Optional<Certificate> findByVerificationCode(String verificationCode);

    @Query("""
            SELECT certificate
            FROM Certificate certificate
            JOIN FETCH certificate.course course
            LEFT JOIN FETCH course.teacher
            WHERE certificate.student.id = :studentId
            ORDER BY certificate.updatedAt DESC
            """)
    List<Certificate> findByStudentWithCourse(@Param("studentId") UUID studentId);

    @Query("""
            SELECT certificate
            FROM Certificate certificate
            JOIN FETCH certificate.student
            JOIN FETCH certificate.course course
            LEFT JOIN FETCH course.teacher
            LEFT JOIN FETCH certificate.finalExamAttempt
            WHERE certificate.id = :id
              AND certificate.student.id = :studentId
            """)
    Optional<Certificate> findDetailByIdAndStudentId(
            @Param("id") UUID id,
            @Param("studentId") UUID studentId);
}
