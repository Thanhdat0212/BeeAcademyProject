package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.CertificateStatus;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CertificateServiceTest {

    @Mock CertificateRepository certificateRepository;
    @Mock EnrollmentRepository enrollmentRepository;
    @Mock CourseRepository courseRepository;
    @Mock ProfileRepository profileRepository;
    @Mock CertificateEligibilityService certificateEligibilityService;
    @Mock SupabaseStorageClient storageClient;

    @InjectMocks CertificateService service;

    @Test
    void finalExamGradeChangeRecalculatesAndRevokesCertificate() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Profile student = mock(Profile.class);
        Course course = mock(Course.class);
        ExamConfig changedConfig = mock(ExamConfig.class);
        ExamAttempt changedAttempt = mock(ExamAttempt.class);
        ExamAttempt finalAttempt = mock(ExamAttempt.class);
        when(student.getId()).thenReturn(studentId);
        when(course.getId()).thenReturn(courseId);
        when(changedConfig.getCourse()).thenReturn(course);
        when(changedAttempt.getStudent()).thenReturn(student);
        when(changedAttempt.getExamConfig()).thenReturn(changedConfig);

        Certificate certificate = Certificate.pending(student, course);
        certificate.issue(finalAttempt, "certificates/original.pdf", false);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(certificateEligibilityService.isRequiredExamAttempt(enrollment, changedAttempt))
                .thenReturn(true);
        when(certificateRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(certificate));
        when(certificateEligibilityService.evaluate(enrollment))
                .thenReturn(new CertificateEligibilityService.Eligibility(
                        true, false, false, null, Set.of()));

        service.handleRequiredExamGradeChanged(changedAttempt);

        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.REVOKED);
        verify(certificateRepository, times(2)).save(certificate);
    }

    @Test
    void gradeChangeFromAnotherCourseVersionDoesNotTouchCertificate() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Profile student = mock(Profile.class);
        Course course = mock(Course.class);
        ExamConfig config = mock(ExamConfig.class);
        ExamAttempt attempt = mock(ExamAttempt.class);
        when(student.getId()).thenReturn(studentId);
        when(course.getId()).thenReturn(courseId);
        when(config.getCourse()).thenReturn(course);
        when(attempt.getStudent()).thenReturn(student);
        when(attempt.getExamConfig()).thenReturn(config);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(certificateEligibilityService.isRequiredExamAttempt(enrollment, attempt))
                .thenReturn(false);

        service.handleRequiredExamGradeChanged(attempt);

        verify(certificateRepository, never()).findByStudentIdAndCourseId(studentId, courseId);
    }

    @Test
    void requestIssueExplainsThatAllFourRequiredExamsAreRequired() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(certificateEligibilityService.evaluate(enrollment))
                .thenReturn(new CertificateEligibilityService.Eligibility(
                        true, false, false, null, Set.of()));

        assertThatThrownBy(() -> service.requestIssue(
                courseId,
                new AuthenticatedUser(studentId, "student@example.com", "student")))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException business = (BusinessException) ex;
                    assertThat(business.getCode()).isEqualTo("CERTIFICATE_NOT_ELIGIBLE");
                    assertThat(business.getMessage()).contains("4 bài kiểm tra bắt buộc");
                });
    }

    @Test
    void issuedCertificatePdfContainsTeacherName() throws Exception {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, UUID.randomUUID());
        Profile student = mock(Profile.class);
        Profile teacher = mock(Profile.class);
        Course course = mock(Course.class);
        ExamAttempt finalAttempt = mock(ExamAttempt.class);

        when(student.getFullName()).thenReturn("Nguyễn Văn An");
        when(teacher.getFullName()).thenReturn("Nguyễn Thị Lan");
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Toán lớp 8");
        when(course.getSlug()).thenReturn("toan-lop-8");
        when(course.getTeacher()).thenReturn(teacher);
        when(finalAttempt.getEffectiveScorePercent()).thenReturn(java.math.BigDecimal.valueOf(85));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(certificateEligibilityService.evaluate(enrollment))
                .thenReturn(new CertificateEligibilityService.Eligibility(
                        true, true, true, finalAttempt, Set.of()));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(courseRepository.findWithCategoryAndTeacherById(courseId)).thenReturn(Optional.of(course));
        when(certificateRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.empty());
        when(certificateRepository.save(any(Certificate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.requestIssue(courseId,
                new AuthenticatedUser(studentId, "student@example.com", "student"));

        ArgumentCaptor<byte[]> pdfCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(storageClient).upload(
                eq("certificates"), anyString(), eq("application/pdf"), pdfCaptor.capture());
        PdfReader reader = new PdfReader(pdfCaptor.getValue());
        String pdfText = new PdfTextExtractor(reader).getTextFromPage(1);
        reader.close();

        assertThat(pdfText).contains("Teacher: Nguyễn Thị Lan");
        assertThat(pdfText).contains("passing all 4 required exams");
    }
}
