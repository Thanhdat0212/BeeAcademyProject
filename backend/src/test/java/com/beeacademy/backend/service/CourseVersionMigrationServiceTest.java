package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CourseVersionMigrationRequest;
import com.beeacademy.backend.dto.response.CourseVersionMigrationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionMigrationLogRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CourseVersionMigrationServiceTest {

    @Mock CourseRepository courseRepository;
    @Mock CourseVersionRepository courseVersionRepository;
    @Mock EnrollmentRepository enrollmentRepository;
    @Mock CourseProgressItemRepository progressRepository;
    @Mock QuizConfigRepository quizConfigRepository;
    @Mock CertificateRepository certificateRepository;
    @Mock CourseVersionMigrationLogRepository migrationLogRepository;
    @Mock ParentStudentLinkRepository parentLinkRepository;
    @Mock TeacherAccessService teacherAccessService;
    @Mock UserNotificationService notificationService;

    private CourseVersionMigrationService service;

    @BeforeEach
    void setUp() {
        service = new CourseVersionMigrationService(
                courseRepository,
                courseVersionRepository,
                enrollmentRepository,
                progressRepository,
                quizConfigRepository,
                certificateRepository,
                migrationLogRepository,
                parentLinkRepository,
                teacherAccessService,
                notificationService,
                new ObjectMapper());
    }

    @Test
    void migrateUpdatesEnrollmentAuditsAndNotifiesStudent() {
        Fixture fixture = arrangeFixture();

        CourseVersionMigrationResponse response = service.migrate(
                fixture.courseId,
                fixture.request,
                new AuthenticatedUser(UUID.randomUUID(), "admin@bee.vn", "admin"));

        assertThat(response.migratedEnrollmentCount()).isEqualTo(1);
        assertThat(fixture.enrollment.getCourseVersionId()).isEqualTo(fixture.targetVersionId);
        verify(migrationLogRepository).save(any());
        verify(notificationService).notify(
                eq(fixture.studentId),
                eq("course_version_migrated"),
                any(),
                any(),
                any());
    }

    @Test
    void migrateRejectsIncompleteFinalExamMapping() {
        Fixture fixture = arrangeFixture();
        CourseVersionMigrationRequest invalid = new CourseVersionMigrationRequest(
                fixture.targetVersionId,
                List.of(fixture.studentId),
                Map.of(),
                Map.of(),
                "MARK_NEEDS_REVIEW",
                "Cập nhật chương trình");

        assertThatThrownBy(() -> service.migrate(
                fixture.courseId,
                invalid,
                new AuthenticatedUser(UUID.randomUUID(), "admin@bee.vn", "admin")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("mapping bài kiểm tra");
    }

    private Fixture arrangeFixture() {
        UUID courseId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID sourceVersionId = UUID.randomUUID();
        UUID targetVersionId = UUID.randomUUID();
        UUID sourceExamId = UUID.randomUUID();
        UUID targetExamId = UUID.randomUUID();

        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Toán 8");
        when(courseRepository.findWithCategoryAndTeacherById(courseId))
                .thenReturn(Optional.of(course));

        CourseVersion sourceVersion = mock(CourseVersion.class);
        when(sourceVersion.getId()).thenReturn(sourceVersionId);
        when(sourceVersion.getVersionNo()).thenReturn(1);
        when(sourceVersion.getSnapshotJson()).thenReturn(snapshot(sourceExamId));
        when(courseVersionRepository.findById(sourceVersionId))
                .thenReturn(Optional.of(sourceVersion));

        CourseVersion targetVersion = mock(CourseVersion.class);
        when(targetVersion.getId()).thenReturn(targetVersionId);
        when(targetVersion.getVersionNo()).thenReturn(2);
        when(targetVersion.getCourse()).thenReturn(course);
        when(targetVersion.isApproved()).thenReturn(true);
        when(targetVersion.getSnapshotJson()).thenReturn(snapshot(targetExamId));
        when(courseVersionRepository.findById(targetVersionId))
                .thenReturn(Optional.of(targetVersion));

        Enrollment enrollment = Enrollment.create(studentId, courseId, sourceVersionId);
        when(enrollmentRepository.findByCourseIdAndStudentIdIn(courseId, List.of(studentId)))
                .thenReturn(List.of(enrollment));
        when(progressRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(List.of());
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(certificateRepository.findByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(Optional.empty());
        when(parentLinkRepository.findByIdStudentIdAndStatusOrderByInvitedAtDesc(
                eq(studentId), any())).thenReturn(List.of());

        Map<UUID, UUID> examMapping = new LinkedHashMap<>();
        examMapping.put(sourceExamId, targetExamId);
        CourseVersionMigrationRequest request = new CourseVersionMigrationRequest(
                targetVersionId,
                List.of(studentId),
                Map.of(),
                examMapping,
                "MARK_NEEDS_REVIEW",
                "Cập nhật chương trình");
        return new Fixture(
                courseId, studentId, targetVersionId, enrollment, request);
    }

    private String snapshot(UUID examId) {
        return """
                {
                  "chapters": [],
                  "quizChapterIds": [],
                  "requiredExams": [{"id": "%s"}]
                }
                """.formatted(examId);
    }

    private record Fixture(
            UUID courseId,
            UUID studentId,
            UUID targetVersionId,
            Enrollment enrollment,
            CourseVersionMigrationRequest request) {
    }
}
