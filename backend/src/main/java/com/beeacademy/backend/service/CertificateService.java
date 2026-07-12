package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.CertificateResponse;
import com.beeacademy.backend.dto.response.CertificateVerificationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.CertificateStatus;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfGState;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.PdfStamper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateService {

    private static final int FINAL_EXAM_SLOT_INDEX = 3;
    private static final String CERTIFICATE_BUCKET = "certificates";
    private static final int CERTIFICATE_SIGNED_URL_TTL_SECONDS = 600;

    private final CertificateRepository certificateRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final ProfileRepository profileRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CourseProgressItemRepository progressItemRepository;
    private final SupabaseStorageClient storageClient;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Transactional(readOnly = true)
    public List<CertificateResponse> listMyCertificates(AuthenticatedUser me) {
        return certificateRepository.findByStudentWithCourse(me.userId()).stream()
                .map(certificate -> CertificateResponse.from(certificate, null, null, null))
                .toList();
    }

    @Transactional
    public CertificateResponse requestIssue(UUID courseId, AuthenticatedUser me) {
        requireEnrollment(me.userId(), courseId);
        Certificate certificate = issueIfEligible(me.userId(), courseId)
                .orElseThrow(() -> new BusinessException(
                        "CERTIFICATE_NOT_ELIGIBLE",
                        "Ban can hoan thanh 100% khoa hoc va dat bai kiem tra cuoi ky 2 de nhan chung chi.",
                        HttpStatus.BAD_REQUEST));
        return certificateResponseWithUrls(certificate);
    }

    @Transactional(readOnly = true)
    public CertificateResponse getMyCertificate(UUID certificateId, AuthenticatedUser me) {
        Certificate certificate = certificateRepository.findDetailByIdAndStudentId(certificateId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Certificate", certificateId));
        return certificateResponseWithUrls(certificate);
    }

    @Transactional(readOnly = true)
    public CertificateVerificationResponse verify(String verificationCode) {
        Certificate certificate = certificateRepository.findByVerificationCode(verificationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Certificate", verificationCode));
        return CertificateVerificationResponse.from(certificate);
    }

    @Transactional
    public void tryIssueAfterProgress(UUID studentId, UUID courseId) {
        if (studentId == null || courseId == null) return;
        issueIfEligible(studentId, courseId);
    }

    @Transactional
    public void handleFinalExamGradeChanged(ExamAttempt attempt) {
        if (!isFinalExamAttempt(attempt)) return;

        UUID studentId = attempt.getStudent().getId();
        UUID courseId = attempt.getExamConfig().getCourse().getId();
        Certificate certificate = certificateRepository
                .findByStudentIdAndCourseId(studentId, courseId)
                .orElse(null);

        if (certificate != null
                && (certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED)) {
            certificate.markNeedsReview("Final exam score was changed by teacher.");
            certificateRepository.save(certificate);
        }

        if (isEligible(studentId, courseId)) {
            issueIfEligible(studentId, courseId);
        } else if (certificate != null && certificate.hasBeenIssuedBefore()) {
            certificate.revoke("Final exam no longer satisfies certificate requirements.");
            certificateRepository.save(certificate);
        }
    }

    private java.util.Optional<Certificate> issueIfEligible(UUID studentId, UUID courseId) {
        if (!isEligible(studentId, courseId)) {
            return java.util.Optional.empty();
        }

        Profile student = profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        ExamAttempt finalAttempt = bestPassedFinalAttempt(studentId, courseId);

        Certificate certificate = certificateRepository
                .findByStudentIdAndCourseId(studentId, courseId)
                .orElseGet(() -> Certificate.pending(student, course));

        if ((certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED)
                && certificate.getFinalExamAttempt() != null
                && certificate.getFinalExamAttempt().getId().equals(finalAttempt.getId())) {
            return java.util.Optional.of(certificate);
        }

        boolean reissue = certificate.hasBeenIssuedBefore();
        byte[] pdf = buildCertificatePdf(certificate, student, course, finalAttempt, reissue);
        String storagePath = buildStoragePath(studentId, courseId, certificate.getCertificateNo(), certificate.getVersionNo() + 1);
        storageClient.upload(CERTIFICATE_BUCKET, storagePath, "application/pdf", pdf);
        certificate.issue(finalAttempt, storagePath, reissue);

        Certificate saved = certificateRepository.save(certificate);
        log.info("Certificate {} {} for student={} course={}",
                saved.getStatus(), saved.getCertificateNo(), studentId, courseId);
        return java.util.Optional.of(saved);
    }

    private boolean isEligible(UUID studentId, UUID courseId) {
        return hasCompletedCourse(studentId, courseId)
                && !examAttemptRepository
                .findPassedFinalAttempts(studentId, courseId, FINAL_EXAM_SLOT_INDEX)
                .isEmpty();
    }

    private boolean hasCompletedCourse(UUID studentId, UUID courseId) {
        long total = courseRepository.countProgressItemsByCourseId(courseId);
        if (total <= 0) return false;
        long completed = Math.min(progressItemRepository.countByStudentIdAndCourseId(studentId, courseId), total);
        return completed >= total;
    }

    private ExamAttempt bestPassedFinalAttempt(UUID studentId, UUID courseId) {
        return examAttemptRepository.findPassedFinalAttempts(studentId, courseId, FINAL_EXAM_SLOT_INDEX)
                .stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        "FINAL_EXAM_NOT_PASSED",
                        "Chua co bai kiem tra cuoi ky 2 dat yeu cau.",
                        HttpStatus.BAD_REQUEST));
    }

    private void requireEnrollment(UUID studentId, UUID courseId) {
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new BusinessException(
                    "COURSE_NOT_ENROLLED",
                    "Ban can ghi danh khoa hoc truoc khi nhan chung chi.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private boolean isFinalExamAttempt(ExamAttempt attempt) {
        return attempt != null
                && attempt.getExamConfig() != null
                && FINAL_EXAM_SLOT_INDEX == attempt.getExamConfig().getSlotIndex();
    }

    private CertificateResponse certificateResponseWithUrls(Certificate certificate) {
        String filename = certificateFilename(certificate);
        return CertificateResponse.from(
                certificate,
                signedViewUrl(certificate),
                filename,
                signedDownloadUrl(certificate, filename));
    }

    private String signedViewUrl(Certificate certificate) {
        if (certificate.getPdfStoragePath() == null
                || !(certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED)) {
            return null;
        }
        return storageClient.generateSignedUrl(
                CERTIFICATE_BUCKET,
                certificate.getPdfStoragePath(),
                CERTIFICATE_SIGNED_URL_TTL_SECONDS);
    }

    private String signedDownloadUrl(Certificate certificate, String filename) {
        if (certificate.getPdfStoragePath() == null
                || !(certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED)) {
            return null;
        }
        return storageClient.generateSignedDownloadUrl(
                CERTIFICATE_BUCKET,
                certificate.getPdfStoragePath(),
                CERTIFICATE_SIGNED_URL_TTL_SECONDS,
                filename);
    }

    private byte[] buildCertificatePdf(
            Certificate certificate,
            Profile student,
            Course course,
            ExamAttempt finalAttempt,
            boolean reissue) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4.rotate(), 56, 56, 48, 48);
            PdfWriter.getInstance(document, output);
            document.open();

            Rectangle border = new Rectangle(36, 36, PageSize.A4.getHeight() - 36, PageSize.A4.getWidth() - 36);
            border.setBorder(Rectangle.BOX);
            border.setBorderWidth(2f);
            border.setBorderColor(new Color(173, 44, 0));
            document.add(border);

            Font titleFont = new Font(Font.HELVETICA, 30, Font.BOLD, new Color(173, 44, 0));
            Font headingFont = new Font(Font.HELVETICA, 18, Font.BOLD, Color.BLACK);
            Font normalFont = new Font(Font.HELVETICA, 12, Font.NORMAL, Color.DARK_GRAY);
            Font nameFont = new Font(Font.HELVETICA, 26, Font.BOLD, Color.BLACK);
            Font smallFont = new Font(Font.HELVETICA, 9, Font.NORMAL, Color.GRAY);

            Paragraph brand = centered("BEE ACADEMY", titleFont);
            brand.setSpacingAfter(12);
            document.add(brand);
            document.add(centered(reissue ? "CERTIFICATE OF COURSE COMPLETION - REISSUED"
                    : "CERTIFICATE OF COURSE COMPLETION", headingFont));
            document.add(centered("This certificate is awarded to", normalFont));

            Paragraph studentName = centered(safeText(student.getFullName(), "Student"), nameFont);
            studentName.setSpacingBefore(16);
            studentName.setSpacingAfter(12);
            document.add(studentName);

            document.add(centered("for completing 100% of the course and passing the final exam", normalFont));
            Paragraph courseTitle = centered(safeText(course.getTitle(), "Course"), headingFont);
            courseTitle.setSpacingBefore(10);
            courseTitle.setSpacingAfter(16);
            document.add(courseTitle);

            BigDecimal score = finalAttempt.getEffectiveScorePercent();
            String issuedDate = DateTimeFormatter.ofPattern("dd/MM/yyyy")
                    .withZone(ZoneId.systemDefault())
                    .format(java.time.Instant.now());
            document.add(centered("Final exam: passed"
                    + (score != null ? " - Score " + score.stripTrailingZeros().toPlainString() + "%" : "")
                    + " | Issued: " + issuedDate, normalFont));
            document.add(Chunk.NEWLINE);

            Image qr = Image.getInstance(buildQrPngBytes(verificationUrl(certificate)));
            qr.scaleAbsolute(110, 110);
            qr.setAlignment(Element.ALIGN_CENTER);
            document.add(qr);

            document.add(centered("Certificate No: " + certificate.getCertificateNo(), smallFont));
            document.add(centered("Verify: " + verificationUrl(certificate), smallFont));
            document.close();
            return watermarkPdf(output.toByteArray(), safeText(student.getFullName(), "Student"), issuedDate);
        } catch (Exception ex) {
            throw new BusinessException("CERTIFICATE_PDF_FAILED",
                    "Khong the tao file chung chi.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private byte[] buildQrPngBytes(String value) throws Exception {
        BitMatrix matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 220, 220);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", output);
        return output.toByteArray();
    }

    private Paragraph centered(String text, Font font) {
        Paragraph paragraph = new Paragraph(text, font);
        paragraph.setAlignment(Element.ALIGN_CENTER);
        paragraph.setSpacingAfter(8);
        return paragraph;
    }

    /** Watermark de ban PDF tai ve luon gan voi hoc sinh va ngay phat hanh. */
    private byte[] watermarkPdf(byte[] source, String studentName, String issuedDate) {
        try {
            PdfReader reader = new PdfReader(source);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            PdfStamper stamper = new PdfStamper(reader, output);
            Font watermarkFont = new Font(Font.HELVETICA, 18, Font.BOLD, new Color(120, 120, 120));
            String watermark = "BEE ACADEMY | " + studentName + " | " + issuedDate;
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                Rectangle pageSize = reader.getPageSizeWithRotation(page);
                PdfContentByte canvas = stamper.getOverContent(page);
                PdfGState opacity = new PdfGState();
                opacity.setFillOpacity(0.13f);
                canvas.saveState();
                canvas.setGState(opacity);
                ColumnText.showTextAligned(canvas, Element.ALIGN_CENTER,
                        new com.lowagie.text.Phrase(watermark, watermarkFont),
                        pageSize.getWidth() / 2f, pageSize.getHeight() / 2f, 35f);
                canvas.restoreState();
            }
            stamper.close();
            reader.close();
            return output.toByteArray();
        } catch (Exception ex) {
            throw new BusinessException("CERTIFICATE_PDF_FAILED",
                    "Khong the dong dau file chung chi.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String safeText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String verificationUrl(Certificate certificate) {
        String base = frontendUrl == null || frontendUrl.isBlank()
                ? "http://localhost:3000"
                : frontendUrl.replaceAll("/+$", "");
        return base + "/certificates/verify/" + certificate.getVerificationCode();
    }

    private String buildStoragePath(UUID studentId, UUID courseId, String certificateNo, int versionNo) {
        return "certificates/%s/%s/%s-v%d.pdf".formatted(
                studentId,
                courseId,
                certificateNo.toLowerCase(),
                versionNo);
    }

    private String certificateFilename(Certificate certificate) {
        String courseCode = safeFilenamePart(certificate.getCourse().getSlug(), "course");
        String studentName = safeFilenamePart(certificate.getStudent().getFullName(), "student");
        return "CERT-" + courseCode + "-" + studentName + ".pdf";
    }

    private String safeFilenamePart(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String normalized = Normalizer.normalize(value.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^A-Za-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized.isBlank() ? fallback : normalized;
    }
}
