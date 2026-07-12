package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.CertificateStatus;

import java.time.Instant;
import java.util.UUID;

public record CertificateResponse(
        UUID id,
        UUID courseId,
        String courseTitle,
        String teacherName,
        CertificateStatus status,
        String certificateNo,
        String verificationCode,
        Integer versionNo,
        Instant issuedAt,
        Instant revokedAt,
        String reviewNote,
        String viewUrl,
        String downloadFileName,
        String downloadUrl
) {
    public static CertificateResponse from(Certificate certificate, String viewUrl,
                                           String downloadFileName, String downloadUrl) {
        return new CertificateResponse(
                certificate.getId(),
                certificate.getCourse().getId(),
                certificate.getCourse().getTitle(),
                certificate.getCourse().getTeacher() != null
                        ? certificate.getCourse().getTeacher().getFullName()
                        : null,
                certificate.getStatus(),
                certificate.getCertificateNo(),
                certificate.getVerificationCode(),
                certificate.getVersionNo(),
                certificate.getIssuedAt(),
                certificate.getRevokedAt(),
                certificate.getReviewNote(),
                viewUrl,
                downloadFileName,
                downloadUrl
        );
    }
}
