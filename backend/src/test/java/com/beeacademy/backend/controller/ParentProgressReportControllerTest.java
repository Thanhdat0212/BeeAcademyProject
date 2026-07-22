package com.beeacademy.backend.controller;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.ParentLinkAuditLogRepository;
import com.beeacademy.backend.repository.ParentProgressAccessAuditRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.service.ParentLinkInvitationEmailService;
import com.beeacademy.backend.service.ParentLinkService;
import com.beeacademy.backend.service.ParentPaymentService;
import com.beeacademy.backend.service.ParentProgressService;
import com.beeacademy.backend.service.ParentService;
import com.beeacademy.backend.service.ParentTeacherMessageEmailService;
import com.beeacademy.backend.service.ParentTeacherMessagingService;
import com.beeacademy.backend.service.CertificateService;
import com.beeacademy.backend.service.CourseProgressService;
import com.beeacademy.backend.service.CourseVersionSnapshotService;
import com.beeacademy.backend.service.ExamConfigVersionService;
import com.beeacademy.backend.service.LearningProgressPdfService;
import com.beeacademy.backend.service.UserNotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ParentProgressReportControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Mock private ProfileRepository profileRepository;
    @Mock private ParentStudentLinkRepository linkRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private QuizConfigRepository quizConfigRepository;
    @Mock private ExamConfigRepository examConfigRepository;
    @Mock private QuizAttemptRepository quizAttemptRepository;
    @Mock private ExamAttemptRepository examAttemptRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private AssignmentSubmissionRepository assignmentSubmissionRepository;
    @Mock private QaThreadRepository qaThreadRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private ParentProgressAccessAuditRepository progressAccessAuditRepository;
    @Mock private ParentLinkAuditLogRepository parentLinkAuditLogRepository;
    @Mock private CertificateRepository certificateRepository;
    @Mock private ChapterRepository chapterRepository;
    @Mock private CourseProgressItemRepository courseProgressItemRepository;
    @Mock private ParentLinkInvitationEmailService parentLinkInvitationEmailService;
    @Mock private SupabaseStorageClient storageClient;
    @Mock private UserNotificationService notificationService;
    @Mock private ParentTeacherMessageEmailService parentTeacherMessageEmailService;
    @Mock private CertificateService certificateService;
    @Mock private CourseVersionSnapshotService courseVersionSnapshotService;
    @Mock private LearningProgressPdfService learningProgressPdfService;
    @Mock private ExamConfigVersionService examConfigVersionService;

    private ParentService parentService;

    @InjectMocks
    private CourseProgressService courseProgressService;

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
        parentService = new ParentService(
                parentLinkService,
                parentProgressService,
                parentPaymentService,
                messagingService);
        lenient().when(examConfigVersionService.forEnrollment(any(Enrollment.class)))
                .thenReturn(List.of());
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("ST-PRN-001: progress is visible within five minutes and weekly rules compare two periods")
    void progressReportApiProvesFreshnessSlaAndWeeklyRules() throws Exception {
        UUID parentId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID courseVersionId = UUID.randomUUID();
        UUID chapterId = UUID.randomUUID();
        LocalDate today = LocalDate.now();

        Profile parent = Profile.createNew(parentId, UserRole.PARENT, "Parent One");
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Student One");
        ParentStudentLink link = ParentStudentLink.createActiveLink(parent, student);

        Enrollment enrollment = Enrollment.create(studentId, courseId, courseVersionId);
        ReflectionTestUtils.setField(enrollment, "enrolledAt", Instant.now().minus(Duration.ofDays(30)));

        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Math 6");
        when(course.getTeacher()).thenReturn(null);
        when(course.getGrades()).thenReturn(new int[] {6});

        Chapter chapter = mock(Chapter.class);
        when(chapter.getId()).thenReturn(chapterId);
        when(chapter.getCourse()).thenReturn(course);
        when(chapter.getTitle()).thenReturn("Chapter 1");

        QuizConfig quizConfig = mock(QuizConfig.class);
        when(quizConfig.getId()).thenReturn(UUID.randomUUID());
        when(quizConfig.getChapter()).thenReturn(chapter);

        QuizAttempt previousAttemptOne = quizAttempt(
                quizConfig,
                BigDecimal.valueOf(8.0),
                today.minusDays(8).atStartOfDay(ZoneId.systemDefault()).toInstant());
        QuizAttempt previousAttemptTwo = quizAttempt(
                quizConfig,
                BigDecimal.valueOf(9.0),
                today.minusDays(9).atStartOfDay(ZoneId.systemDefault()).toInstant());
        List<com.beeacademy.backend.model.CourseProgressItem> completedItems = new ArrayList<>();

        when(linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId))
                .thenReturn(Optional.of(link));
        when(enrollmentRepository.findByStudentId(studentId)).thenReturn(List.of(enrollment));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.of(enrollment));
        when(courseRepository.existsById(courseId)).thenReturn(true);
        when(courseRepository.countProgressItemsByCourseId(courseId)).thenReturn(4L);
        when(courseRepository.findByIdIn(List.of(courseId))).thenReturn(List.of(course));
        when(certificateRepository.findByStudentWithCourse(studentId)).thenReturn(List.of());
        when(chapterRepository.findWithLessonsByCourseIdIn(List.of(courseId))).thenReturn(List.of());
        when(courseProgressItemRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                studentId, courseId, chapter.getId(), "quiz")).thenReturn(false);
        when(courseProgressItemRepository.save(any()))
                .thenAnswer(invocation -> {
                    com.beeacademy.backend.model.CourseProgressItem item = invocation.getArgument(0);
                    completedItems.add(item);
                    return item;
                });
        when(courseProgressItemRepository.countByStudentIdAndCourseId(studentId, courseId)).thenReturn(1L);
        when(courseProgressItemRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenAnswer(ignored -> List.copyOf(completedItems));
        when(courseProgressItemRepository.findByStudentIdAndCourseIdIn(studentId, List.of(courseId)))
                .thenAnswer(ignored -> List.copyOf(completedItems));
        when(quizConfigRepository.existsByChapterIdAndCourseId(chapter.getId(), courseId)).thenReturn(true);
        when(courseVersionSnapshotService.findMetrics(courseVersionId)).thenReturn(Optional.empty());
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of(quizConfig));
        when(examConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(examAttemptRepository.findByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());
        when(assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of());

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(
                        new CourseProgressController(courseProgressService, learningProgressPdfService),
                        new ParentController(parentService))
                .setMessageConverters(
                        new MappingJackson2HttpMessageConverter(objectMapper),
                        new ByteArrayHttpMessageConverter())
                .build();

        authenticateStudent(studentId);
        Instant progressWriteStartedAt = Instant.now();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/courses/{courseId}/progress/complete", courseId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest(
                                        chapter.getId(), "quiz"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.progressPct").value(25));
        Instant progressWriteFinishedAt = Instant.now();
        Instant progressChangedAt = enrollment.getProgressUpdatedAt();
        assertThat(progressChangedAt).isBetween(progressWriteStartedAt, progressWriteFinishedAt);

        QuizAttempt currentAttempt = quizAttempt(
                quizConfig, BigDecimal.valueOf(4.0), progressChangedAt);
        when(quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, List.of(courseId)))
                .thenReturn(List.of(currentAttempt, previousAttemptOne, previousAttemptTwo));

        authenticateParent(parentId);
        MvcResult result = mockMvc.perform(get("/api/parent/children/{studentId}/progress-report", studentId)
                        .param("courseId", courseId.toString())
                        .param("from", today.toString())
                        .param("to", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courses[0].progressPct").value(25))
                .andExpect(jsonPath("$.data.courses[0].progressUpdatedAt")
                        .value(progressChangedAt.toString()))
                .andExpect(jsonPath("$.data.assessments.length()").value(1))
                .andExpect(jsonPath("$.data.weeklySummary.periodStart")
                        .value(today.minusDays(6).toString()))
                .andExpect(jsonPath("$.data.weeklySummary.periodEnd").value(today.toString()))
                .andExpect(jsonPath("$.data.weeklySummary.progressTrend").value("decreasing"))
                .andExpect(jsonPath("$.data.weeklySummary.currentWeekCompletedItems").value(1))
                .andExpect(jsonPath("$.data.weeklySummary.previousWeekCompletedItems").value(2))
                .andExpect(jsonPath("$.data.weeklySummary.averageScore").value(4.0))
                .andExpect(jsonPath("$.data.weeklySummary.completedAssessments").value(1))
                .andExpect(jsonPath("$.data.weeklySummary.inactiveDays").value(6))
                .andExpect(jsonPath("$.data.weeklySummary.actionRule").value("inactive"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        Instant generatedAt = Instant.parse(body.path("data").path("generatedAt").asText());
        assertThat(generatedAt).isAfterOrEqualTo(progressChangedAt);
        assertThat(Duration.between(progressChangedAt, generatedAt))
                .isLessThanOrEqualTo(Duration.ofMinutes(5));

        MvcResult exportResult = mockMvc.perform(
                        get("/api/parent/children/{studentId}/progress-report/export", studentId)
                                .param("courseId", courseId.toString())
                                .param("from", today.toString())
                                .param("to", today.toString()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(exportResult.getResponse().getContentType()).isEqualTo(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        assertThat(exportResult.getResponse().getHeader("Content-Disposition"))
                .endsWith(".xlsx\"");
        assertThat(exportResult.getResponse().getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(exportResult.getResponse().getContentAsByteArray())
                .startsWith((byte) 'P', (byte) 'K');
    }

    private QuizAttempt quizAttempt(QuizConfig config, BigDecimal score, Instant submittedAt) {
        QuizAttempt attempt = mock(QuizAttempt.class);
        when(attempt.getId()).thenReturn(UUID.randomUUID());
        when(attempt.getQuizConfig()).thenReturn(config);
        when(attempt.getScore()).thenReturn(score);
        when(attempt.getSubmittedAt()).thenReturn(submittedAt);
        return attempt;
    }

    private void authenticateParent(UUID parentId) {
        AuthenticatedUser user = new AuthenticatedUser(parentId, "parent@example.com", "parent");
        var authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_parent")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private void authenticateStudent(UUID studentId) {
        AuthenticatedUser user = new AuthenticatedUser(studentId, "student@example.com", "student");
        var authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_student")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
