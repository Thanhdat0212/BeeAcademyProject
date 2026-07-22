package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.request.RevokeParentStudentLinkRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseProgressItem;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.ParentLinkAuditLog;
import com.beeacademy.backend.model.ParentProgressAccessAudit;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaThread;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.ParentLinkAuditLogRepository;
import com.beeacademy.backend.repository.ParentProgressAccessAuditRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.client.SupabaseStorageClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParentServiceTest {

    @Mock
    private ProfileRepository profileRepository;

    @Mock
    private ParentStudentLinkRepository linkRepository;

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private QuizConfigRepository quizConfigRepository;

    @Mock
    private ExamConfigRepository examConfigRepository;

    @Mock
    private ExamConfigVersionService examConfigVersionService;

    @Mock
    private QuizAttemptRepository quizAttemptRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private AssignmentSubmissionRepository assignmentSubmissionRepository;

    @Mock
    private QaThreadRepository qaThreadRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ParentProgressAccessAuditRepository progressAccessAuditRepository;

    @Mock
    private ParentLinkAuditLogRepository parentLinkAuditLogRepository;

    @Mock
    private CertificateRepository certificateRepository;

    @Mock
    private ChapterRepository chapterRepository;

    @Mock
    private CourseProgressItemRepository courseProgressItemRepository;

    @Mock
    private ParentLinkInvitationEmailService parentLinkInvitationEmailService;

    @Mock
    private SupabaseStorageClient storageClient;

    @Mock
    private UserNotificationService notificationService;

    @Mock
    private ParentTeacherMessageEmailService parentTeacherMessageEmailService;

    private ParentService service;

    @BeforeEach
    void defaultExamConfigs() {
        ParentLinkService parentLinkService = new ParentLinkService(
                profileRepository,
                linkRepository,
                enrollmentRepository,
                courseRepository,
                parentLinkAuditLogRepository,
                parentLinkInvitationEmailService,
                notificationService);
        ParentProgressService parentProgressService = new ParentProgressService(
                linkRepository,
                enrollmentRepository,
                courseRepository,
                quizConfigRepository,
                examConfigRepository,
                examConfigVersionService,
                quizAttemptRepository,
                examAttemptRepository,
                assignmentSubmissionRepository,
                progressAccessAuditRepository,
                certificateRepository,
                chapterRepository,
                courseProgressItemRepository);
        ParentPaymentService parentPaymentService = new ParentPaymentService(
                profileRepository,
                linkRepository,
                enrollmentRepository,
                courseRepository,
                orderRepository);
        ParentTeacherMessagingService messagingService = new ParentTeacherMessagingService(
                profileRepository,
                linkRepository,
                enrollmentRepository,
                courseRepository,
                qaThreadRepository,
                storageClient,
                notificationService,
                parentTeacherMessageEmailService);
        service = new ParentService(
                parentLinkService,
                parentProgressService,
                parentPaymentService,
                messagingService);
        lenient().when(examConfigVersionService.forEnrollment(any(Enrollment.class)))
                .thenReturn(List.of());
    }

    @Test
    void sendLinkInvitationStoresRelationshipNoteAndNotifiesStudent() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.empty());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.ACTIVE.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.PENDING.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.saveAndFlush(any(ParentStudentLink.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of());

        var response = service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest(" STUDENT@example.com ", "mother", "Can theo doi tien do."));

        assertThat(response.studentId()).isEqualTo(studentId);
        assertThat(response.relationship()).isEqualTo("mother");
        assertThat(response.note()).isEqualTo("Can theo doi tien do.");
        assertThat(response.status()).isEqualTo("pending");
        assertThat(response.expiresAt()).isEqualTo(response.invitedAt().plusSeconds(7 * 24 * 60 * 60));
        assertThat(response.expired()).isFalse();

        ArgumentCaptor<ParentStudentLink> linkCaptor = ArgumentCaptor.forClass(ParentStudentLink.class);
        verify(linkRepository).saveAndFlush(linkCaptor.capture());
        assertThat(linkCaptor.getValue().getRelationship()).isEqualTo("mother");
        assertThat(linkCaptor.getValue().getNote()).isEqualTo("Can theo doi tien do.");

        verify(parentLinkInvitationEmailService).sendInvitation(
                "student@example.com",
                "Student One",
                "Parent One");
        verify(notificationService).notify(
                studentId,
                "parent_link_invitation",
                "Parent link invitation",
                "Parent One invited you to link parent account on Bee Academy.",
                "/student/notifications");
    }

    @Test
    void sendLinkInvitationRejectsExistingPendingInvitation() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink pending = ParentStudentLink.createPendingInvitation(parent, student);

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest("student@example.com", "father", null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_LINK_ALREADY_EXISTS");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(linkRepository, never()).saveAndFlush(any());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
    }

    @Test
    void sendLinkInvitationRejectsWhenParentAlreadyHasFiveChildren() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        List<ParentStudentLink> active = List.of(
                ParentStudentLink.createActiveLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S1")),
                ParentStudentLink.createActiveLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S2")),
                ParentStudentLink.createActiveLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S3")),
                ParentStudentLink.createActiveLink(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S4")));
        List<ParentStudentLink> pending = List.of(
                ParentStudentLink.createPendingInvitation(parent, Profile.createNew(UUID.randomUUID(), UserRole.STUDENT, "S5")));

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.empty());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.ACTIVE.toDbValue()))
                .thenReturn(active);
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.PENDING.toDbValue()))
                .thenReturn(pending);

        assertThatThrownBy(() -> service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest("student@example.com", "guardian", null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("PARENT_CHILD_LIMIT_EXCEEDED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(linkRepository, never()).saveAndFlush(any());
    }

    @Test
    void parentCanImmediatelyRevokeActiveLinkAndUcs24To26BecomeUnavailable() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID operationId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink link = ParentStudentLink.createActiveLink(parent, student);
        when(linkRepository.findForUpdate(parentId, studentId)).thenReturn(Optional.of(link));
        when(linkRepository.saveAndFlush(link)).thenReturn(link);
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of());

        var response = service.revokeStudentLink(
                parentUser(parentId),
                studentId,
                new RevokeParentStudentLinkRequest(operationId, "  Học sinh đã trưởng thành.  "));

        assertThat(response.getLinkStatus()).isEqualTo("revoked");
        ArgumentCaptor<ParentLinkAuditLog> auditCaptor = ArgumentCaptor.forClass(ParentLinkAuditLog.class);
        verify(parentLinkAuditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("revoke_link");
        assertThat(auditCaptor.getValue().getOperationId()).isEqualTo(operationId);
        assertThat(auditCaptor.getValue().getReason()).isEqualTo("Học sinh đã trưởng thành.");
        verify(notificationService).notify(
                studentId,
                "parent_link_revoked",
                "Liên kết phụ huynh đã bị hủy",
                "Liên kết với Parent One đã bị hủy.",
                "/student/notifications");

        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.of(link));
        assertThatThrownBy(() -> service.getChildOverview(parentUser(parentId), studentId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("LINK_NOT_ACTIVE");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });
        assertThatThrownBy(() -> service.getChildTeacherConversations(parentUser(parentId), studentId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("ACCESS_DENIED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });
        assertThatThrownBy(() -> service.getChildPaymentHistory(parentUser(parentId), studentId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("ACCESS_DENIED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });
    }

    @Test
    void revokedLinkCanBeInvitedAgain() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink revoked = ParentStudentLink.createActiveLink(parent, student);
        revoked.revoke();

        when(profileRepository.findUserIdByEmail("student@example.com")).thenReturn(Optional.of(studentId));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.of(revoked));
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.ACTIVE.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(parentId, ParentStudentLinkStatus.PENDING.toDbValue()))
                .thenReturn(List.of());
        when(linkRepository.saveAndFlush(revoked)).thenReturn(revoked);

        var response = service.sendLinkInvitation(
                parentUser(parentId),
                new SendParentLinkInvitationRequest("student@example.com", "guardian", null));

        assertThat(response.status()).isEqualTo("pending");
        assertThat(revoked.getStatus()).isEqualTo(ParentStudentLinkStatus.PENDING);
    }

    @Test
    void childProgressReportReflectsRecentProgressWithinFiveMinutes() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID courseVersionId = UUID.randomUUID();
        Instant progressChangedAt = Instant.now().minusSeconds(30);

        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink link = ParentStudentLink.createActiveLink(parent, student);

        Enrollment enrollment = org.mockito.Mockito.mock(Enrollment.class);
        when(enrollment.getCourseId()).thenReturn(courseId);
        when(enrollment.getCourseVersionId()).thenReturn(courseVersionId);
        when(enrollment.getProgressPct()).thenReturn(42);
        when(enrollment.getEnrolledAt()).thenReturn(progressChangedAt);
        when(enrollment.getProgressUpdatedAt()).thenReturn(progressChangedAt);

        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Math 6");
        when(course.getTeacher()).thenReturn(null);
        when(course.getGrades()).thenReturn(new int[] {6});
        Certificate certificate = Certificate.pending(student, course);
        UUID chapterId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        Instant completedAt = Instant.now().minusSeconds(120);
        Chapter chapter = org.mockito.Mockito.mock(Chapter.class);
        Lesson lesson = org.mockito.Mockito.mock(Lesson.class);
        CourseProgressItem completedLesson = CourseProgressItem.create(studentId, courseId, lessonId, "lesson");
        ReflectionTestUtils.setField(completedLesson, "completedAt", completedAt);
        when(chapter.getId()).thenReturn(chapterId);
        when(chapter.getCourse()).thenReturn(course);
        when(chapter.getTitle()).thenReturn("Chapter 1");
        when(chapter.getPosition()).thenReturn(1);
        when(chapter.getLessons()).thenReturn(List.of(lesson));
        when(lesson.getId()).thenReturn(lessonId);
        when(lesson.getTitle()).thenReturn("Lesson 1");
        when(lesson.getPosition()).thenReturn(1);
        when(lesson.getDurationSec()).thenReturn(600);

        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of(enrollment));
        when(courseRepository.findByIdIn(List.of(courseId))).thenReturn(List.of(course));
        when(certificateRepository.findByStudentWithCourse(studentId)).thenReturn(List.of(certificate));
        when(chapterRepository.findWithLessonsByCourseIdIn(List.of(courseId))).thenReturn(List.of(chapter));
        when(courseProgressItemRepository.findByStudentIdAndCourseIdIn(studentId, List.of(courseId)))
                .thenReturn(List.of(completedLesson));
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(examConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());

        var report = service.getChildProgressReport(parentUser(parentId), studentId, null, null, null);

        assertThat(report.courses()).hasSize(1);
        assertThat(report.certificates()).hasSize(1);
        assertThat(report.certificates().get(0).courseId()).isEqualTo(courseId);
        assertThat(report.certificates().get(0).status()).isEqualTo("NOT_ISSUED");
        assertThat(report.courses().get(0).completedLessons()).hasSize(1);
        assertThat(report.courses().get(0).completedLessons().get(0).lessonId()).isEqualTo(lessonId);
        assertThat(report.courses().get(0).completedLessons().get(0).lessonTitle()).isEqualTo("Lesson 1");
        assertThat(report.courses().get(0).completedLessons().get(0).completedAt()).isEqualTo(completedAt);
        assertThat(report.courses().get(0).progressPct()).isEqualTo(42);
        assertThat(report.courses().get(0).progressUpdatedAt()).isEqualTo(progressChangedAt);
        assertThat(Duration.between(
                        report.courses().get(0).progressUpdatedAt(), report.generatedAt()))
                .isLessThanOrEqualTo(Duration.ofMinutes(5));
        verify(progressAccessAuditRepository).save(any(ParentProgressAccessAudit.class));
    }

    @Test
    void childProgressReportUsesAllFourExamConfigurationsFromEnrolledCourseVersion() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID courseVersionId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink link = ParentStudentLink.createActiveLink(parent, student);

        Enrollment enrollment = org.mockito.Mockito.mock(Enrollment.class);
        when(enrollment.getCourseId()).thenReturn(courseId);
        when(enrollment.getCourseVersionId()).thenReturn(courseVersionId);
        when(enrollment.getProgressPct()).thenReturn(50);
        when(enrollment.getEnrolledAt()).thenReturn(Instant.now().minus(Duration.ofDays(20)));

        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Math 6");
        when(course.getTeacher()).thenReturn(null);
        when(course.getGrades()).thenReturn(new int[] {6});

        ExamConfig midtermOne = examConfig(course, courseVersionId, 0, "Đánh giá giữa học kỳ I", "chapter_test");
        ExamConfig finalOne = examConfig(course, courseVersionId, 1, "Đánh giá cuối học kỳ I", "chapter_test");
        ExamConfig midtermTwo = examConfig(course, courseVersionId, 2, "Đánh giá giữa học kỳ II", "chapter_test");
        ExamConfig finalTwo = examConfig(course, courseVersionId, 3, "Đánh giá cuối năm", "final_exam");

        Instant submittedAt = Instant.now().minus(Duration.ofHours(2));
        ExamAttempt passedAttempt = examAttempt(midtermOne, BigDecimal.valueOf(84), true, submittedAt);
        ExamAttempt pendingGradingAttempt = examAttempt(midtermTwo, BigDecimal.valueOf(70), null, submittedAt);
        ExamAttempt inProgressAttempt = examAttempt(finalTwo, null, null, null);

        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)).thenReturn(Optional.of(link));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of(enrollment));
        when(courseRepository.findByIdIn(List.of(courseId))).thenReturn(List.of(course));
        when(certificateRepository.findByStudentWithCourse(studentId)).thenReturn(List.of());
        when(chapterRepository.findWithLessonsByCourseIdIn(List.of(courseId))).thenReturn(List.of());
        when(courseProgressItemRepository.findByStudentIdAndCourseIdIn(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(examConfigRepository.findByCourseIds(List.of(courseId)))
                .thenReturn(List.of(midtermOne, finalOne, midtermTwo, finalTwo));
        when(examConfigVersionService.forEnrollment(enrollment))
                .thenReturn(List.of(midtermOne, finalOne, midtermTwo, finalTwo));
        when(quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of(passedAttempt, pendingGradingAttempt, inProgressAttempt));
        when(assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());

        var report = service.getChildProgressReport(parentUser(parentId), studentId, null, null, null);
        var exams = report.courses().get(0).requiredExams();

        assertThat(exams).hasSize(4);
        assertThat(exams).extracting(exam -> exam.slotIndex()).containsExactly(0, 1, 2, 3);
        assertThat(exams.get(0).examName()).isEqualTo("Đánh giá giữa học kỳ I");
        assertThat(exams.get(0).examType()).isEqualTo("chapter_test");
        assertThat(exams.get(0).courseVersionId()).isEqualTo(courseVersionId);
        assertThat(exams.get(0).status()).isEqualTo("passed");
        assertThat(exams.get(0).normalizedScore()).isEqualTo(8.4);
        assertThat(exams.get(1).status()).isEqualTo("not_submitted");
        assertThat(exams.get(2).status()).isEqualTo("pending_grading");
        assertThat(exams.get(3).examName()).isEqualTo("Đánh giá cuối năm");
        assertThat(exams.get(3).examType()).isEqualTo("final_exam");
        assertThat(exams.get(3).status()).isEqualTo("in_progress");
    }

    @Test
    void parentCanExportProgressReportAsExcelWorkbookIncludingCertificates() throws IOException {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink link = ParentStudentLink.createActiveLink(parent, student);

        Enrollment enrollment = org.mockito.Mockito.mock(Enrollment.class);
        when(enrollment.getCourseId()).thenReturn(courseId);
        when(enrollment.getCourseVersionId()).thenReturn(null);
        when(enrollment.getProgressPct()).thenReturn(100);
        when(enrollment.getEnrolledAt()).thenReturn(Instant.now());

        Course course = org.mockito.Mockito.mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Math 6");
        when(course.getTeacher()).thenReturn(null);
        when(course.getGrades()).thenReturn(new int[] {6});
        Certificate certificate = Certificate.pending(student, course);

        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of(enrollment));
        when(courseRepository.findByIdIn(List.of(courseId))).thenReturn(List.of(course));
        when(certificateRepository.findByStudentWithCourse(studentId)).thenReturn(List.of(certificate));
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(examConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());

        byte[] workbookBytes = service.exportChildProgressReportExcel(
                parentUser(parentId), studentId, null, null, null);

        assertThat(workbookBytes).startsWith((byte) 'P', (byte) 'K');
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(workbookBytes))) {
            assertThat(workbook.getSheetName(0)).isEqualTo("Báo cáo tuần");
            assertThat(workbook.getSheet("Tiến độ khóa học")).isNotNull();
            assertThat(workbook.getSheet("4 bài kiểm tra")).isNotNull();
            assertThat(workbook.getSheet("Bài đã học")).isNotNull();
            assertThat(workbook.getSheet("Bảng điểm")).isNotNull();
            assertThat(workbook.getSheet("Chứng chỉ")).isNotNull();
            assertThat(sheetContains(workbook.getSheet("Tiến độ khóa học"), "Math 6")).isTrue();
            assertThat(sheetContains(workbook.getSheet("Chứng chỉ"), certificate.getCertificateNo())).isTrue();

            XSSFSheet weeklySheet = workbook.getSheet("Báo cáo tuần");
            assertThat(weeklySheet.getDrawingPatriarch().getCharts()).hasSize(1);
        }
    }

    @Test
    void parentTeacherMessageStoresTwelveMonthRetentionAndApprovedModeration() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Course course = org.mockito.Mockito.mock(Course.class);
        Instant beforeSend = Instant.now();

        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(linkRepository.existsByIdParentIdAndIdStudentIdAndStatus(
                parentId, studentId, ParentStudentLinkStatus.ACTIVE.toDbValue()))
                .thenReturn(true);
        when(courseRepository.findWithCategoryAndTeacherById(courseId)).thenReturn(Optional.of(course));
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Math 6");
        when(course.getTeacher()).thenReturn(teacher);
        when(course.getCategory()).thenReturn(null);
        when(course.getGrades()).thenReturn(new int[] {6});
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(qaThreadRepository.findParentThreadsForCourse(parentId, studentId, courseId))
                .thenReturn(List.of());
        when(qaThreadRepository.saveAndFlush(any(QaThread.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.sendParentTeacherMessage(
                parentUser(parentId),
                studentId,
                new SendParentTeacherMessageRequest(
                        courseId,
                        "Can trao doi them ve tien do hoc tap.",
                        null,
                        null,
                        null,
                        null));

        ArgumentCaptor<QaThread> threadCaptor = ArgumentCaptor.forClass(QaThread.class);
        verify(qaThreadRepository).saveAndFlush(threadCaptor.capture());
        var message = threadCaptor.getValue().getMessages().get(0);
        assertThat(message.getModerationStatus()).isEqualTo("approved");
        assertThat(message.getModerationReason()).isNull();
        assertThat(message.getRetentionUntil()).isBetween(
                beforeSend.plus(Duration.ofDays(360)),
                beforeSend.plus(Duration.ofDays(370)));
        assertThat(response.pendingModerationCount()).isZero();
        assertThat(response.messageCount()).isEqualTo(1);
    }

    @Test
    void parentTeacherMessageRejectsPolicyViolationBeforePersisting() {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Course course = org.mockito.Mockito.mock(Course.class);

        when(profileRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(linkRepository.existsByIdParentIdAndIdStudentIdAndStatus(
                parentId, studentId, ParentStudentLinkStatus.ACTIVE.toDbValue()))
                .thenReturn(true);
        when(courseRepository.findWithCategoryAndTeacherById(courseId)).thenReturn(Optional.of(course));
        when(course.getId()).thenReturn(courseId);
        when(course.getTeacher()).thenReturn(teacher);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(qaThreadRepository.findParentThreadsForCourse(parentId, studentId, courseId))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.sendParentTeacherMessage(
                parentUser(parentId),
                studentId,
                new SendParentTeacherMessageRequest(
                        courseId,
                        "Day la spam lua dao",
                        null,
                        null,
                        null,
                        null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("MESSAGE_POLICY_VIOLATION");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                });

        verify(qaThreadRepository, never()).saveAndFlush(any(QaThread.class));
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
        verify(parentTeacherMessageEmailService, never())
                .notifyTeacher(any(), any(), any(), any(), any(), any());
    }

    private AuthenticatedUser parentUser(UUID parentId) {
        return new AuthenticatedUser(parentId, "parent@example.com", "parent");
    }

    private ExamConfig examConfig(
            Course course,
            UUID courseVersionId,
            int slotIndex,
            String name,
            String examType) {
        ExamConfig config = org.mockito.Mockito.mock(ExamConfig.class);
        when(config.getId()).thenReturn(UUID.randomUUID());
        when(config.getCourse()).thenReturn(course);
        when(config.getCourseVersionId()).thenReturn(courseVersionId);
        when(config.getSlotIndex()).thenReturn(slotIndex);
        when(config.getName()).thenReturn(name);
        when(config.getExamType()).thenReturn(examType);
        return config;
    }

    private ExamAttempt examAttempt(
            ExamConfig config,
            BigDecimal scorePercent,
            Boolean passed,
            Instant submittedAt) {
        ExamAttempt attempt = org.mockito.Mockito.mock(ExamAttempt.class);
        when(attempt.getExamConfig()).thenReturn(config);
        when(attempt.getEffectiveScorePercent()).thenReturn(scorePercent);
        when(attempt.getPassed()).thenReturn(passed);
        when(attempt.getSubmittedAt()).thenReturn(submittedAt);
        return attempt;
    }

    private boolean sheetContains(Sheet sheet, String expected) {
        DataFormatter formatter = new DataFormatter();
        for (var row : sheet) {
            for (var cell : row) {
                if (formatter.formatCellValue(cell).contains(expected)) {
                    return true;
                }
            }
        }
        return false;
    }
}
