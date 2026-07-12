package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.CertificateStatus;

import java.time.Instant;

public record CertificateVerificationResponse(
        boolean valid,
        CertificateStatus status,
        String certificateNo,
        String studentName,
        String courseTitle,
        String teacherName,
        Integer versionNo,
        Instant issuedAt,
        Instant revokedAt
) {
    public static CertificateVerificationResponse from(Certificate certificate) {
        boolean valid = certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED;
        return new CertificateVerificationResponse(
                valid,
                certificate.getStatus(),
                certificate.getCertificateNo(),
                certificate.getStudent().getFullName(),
                certificate.getCourse().getTitle(),
                certificate.getCourse().getTeacher() != null
                        ? certificate.getCourse().getTeacher().getFullName()
                        : null,
                certificate.getVersionNo(),
                certificate.getIssuedAt(),
                certificate.getRevokedAt()
        );
    }
}
