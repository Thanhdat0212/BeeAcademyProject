package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.StudentDocumentDownload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentDocumentDownloadRepository extends JpaRepository<StudentDocumentDownload, UUID> {

    long countByStudentIdAndDocumentIdAndDownloadedAtAfter(
            UUID studentId, UUID documentId, Instant downloadedAt);

    @Query("SELECT d FROM StudentDocumentDownload d " +
           "WHERE d.expiresAt < :now AND d.temporaryStoragePath IS NOT NULL")
    List<StudentDocumentDownload> findExpiredTemporaryDownloads(@Param("now") Instant now);

    Optional<StudentDocumentDownload> findByTokenHash(String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE StudentDocumentDownload d SET d.consumedAt = :now " +
           "WHERE d.tokenHash = :tokenHash AND d.expiresAt > :now AND d.consumedAt IS NULL")
    int consumeActiveToken(@Param("tokenHash") String tokenHash, @Param("now") Instant now);
}
