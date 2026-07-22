package com.beeacademy.backend.service;

import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamConfigVersionServiceTest {

    @Mock ExamConfigRepository examConfigRepository;
    @Mock CourseVersionRepository courseVersionRepository;
    @Mock CourseVersionSnapshotService courseVersionSnapshotService;

    @InjectMocks ExamConfigVersionService service;

    @Test
    void editingAReleasedExamCreatesDraftCopyInsteadOfMutatingOldVersion() {
        UUID courseId = UUID.randomUUID();
        UUID oldVersionId = UUID.randomUUID();
        Course course = mock(Course.class);
        Profile teacher = mock(Profile.class);
        ExamConfig released = ExamConfig.create(
                course, teacher, 0, null, null,
                "Giữa kỳ 1", null, 45, 60, 2,
                true, true, false,
                "chapter_test", true, true, "[]");
        released.assignCourseVersion(oldVersionId);

        CourseVersion oldVersion = mock(CourseVersion.class);
        when(oldVersion.getId()).thenReturn(oldVersionId);
        when(examConfigRepository.findByCourseIdAndDraftTrueOrderBySlotIndexAsc(courseId))
                .thenReturn(List.of());
        when(courseVersionRepository.findByCourseIdOrderByVersionNoDesc(courseId))
                .thenReturn(List.of(oldVersion));
        when(examConfigRepository
                .findByCourseIdAndCourseVersionIdAndDraftFalseOrderBySlotIndexAsc(
                        courseId, oldVersionId))
                .thenReturn(List.of(released));
        when(examConfigRepository.saveAll(anyList()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        List<ExamConfig> drafts = service.ensureDraftSet(courseId);

        assertThat(drafts).hasSize(1);
        assertThat(drafts.getFirst().getId()).isNotEqualTo(released.getId());
        assertThat(drafts.getFirst().isDraft()).isTrue();
        assertThat(drafts.getFirst().getCourseVersionId()).isNull();
        assertThat(released.isDraft()).isFalse();
        assertThat(released.getCourseVersionId()).isEqualTo(oldVersionId);
    }

    @Test
    void enrollmentUsesExamIdsCapturedInItsOwnVersionSnapshot() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        Enrollment enrollment = Enrollment.create(studentId, courseId, versionId);
        Course course = mock(Course.class);
        ExamConfig versionExam = mock(ExamConfig.class);
        when(course.getId()).thenReturn(courseId);
        when(versionExam.getCourse()).thenReturn(course);
        when(courseVersionSnapshotService.findMetrics(versionId)).thenReturn(Optional.of(
                new CourseVersionSnapshotService.SnapshotMetrics(
                        versionId, 1, Set.of(), Set.of(), Set.of(), true, Set.of(examId))));
        when(examConfigRepository.findAllById(Set.of(examId))).thenReturn(List.of(versionExam));

        List<ExamConfig> result = service.forEnrollment(enrollment);

        assertThat(result).containsExactly(versionExam);
    }
}
