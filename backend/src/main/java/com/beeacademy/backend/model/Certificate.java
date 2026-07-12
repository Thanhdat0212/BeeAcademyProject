package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "certificates",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_certificates_student_course", columnNames = {"student_id", "course_id"}),
                @UniqueConstraint(name = "uk_certificates_no", columnNames = "certificate_no"),
                @UniqueConstraint(name = "uk_certificates_verification", columnNames = "verification_code")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Certificate {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "final_exam_attempt_id")
    private ExamAttempt finalExamAttempt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private CertificateStatus status;

    @Column(name = "certificate_no", nullable = false, unique = true, length = 40)
    private String certificateNo;

    @Column(name = "verification_code", nullable = false, unique = true, length = 80)
    private String verificationCode;

    @Column(name = "pdf_storage_path")
    private String pdfStoragePath;

    @Column(name = "issued_at")
    private Instant issuedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "review_note")
    private String reviewNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static Certificate pending(Profile student, Course course) {
        Certificate certificate = new Certificate();
        certificate.id = UUID.randomUUID();
        certificate.student = student;
        certificate.course = course;
        certificate.status = CertificateStatus.NOT_ISSUED;
        certificate.certificateNo = buildCertificateNo();
        certificate.verificationCode = UUID.randomUUID().toString().replace("-", "");
        certificate.versionNo = 0;
        return certificate;
    }

    public void issue(ExamAttempt attempt, String storagePath, boolean reissue) {
        this.finalExamAttempt = attempt;
        this.pdfStoragePath = storagePath;
        this.versionNo = this.versionNo == null ? 1 : this.versionNo + 1;
        this.status = reissue ? CertificateStatus.REISSUED : CertificateStatus.ISSUED;
        this.issuedAt = Instant.now();
        this.revokedAt = null;
        this.reviewNote = null;
    }

    public void markNeedsReview(String note) {
        if (status == CertificateStatus.ISSUED || status == CertificateStatus.REISSUED) {
            this.status = CertificateStatus.NEEDS_REVIEW;
            this.reviewNote = note;
        }
    }

    public void revoke(String note) {
        this.status = CertificateStatus.REVOKED;
        this.revokedAt = Instant.now();
        this.reviewNote = note;
    }

    public boolean hasBeenIssuedBefore() {
        return issuedAt != null || versionNo != null && versionNo > 0;
    }

    private static String buildCertificateNo() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        return "BEE-CERT-" + suffix;
    }
}
