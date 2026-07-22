package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock EnrollmentRepository enrollmentRepository;
    @Mock CourseRepository courseRepository;
    @Mock PublishedCourseVersionResolver publishedCourseVersionResolver;
    @Mock TeacherRevenueService teacherRevenueService;

    @InjectMocks EnrollmentService enrollmentService;

    @Test
    void enrollPinsApprovedPublishedVersion() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        Course course = mock(Course.class);
        CourseVersion version = mock(CourseVersion.class);
        when(course.getStatus()).thenReturn(CourseStatus.PUBLISHED);
        when(version.getId()).thenReturn(versionId);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(publishedCourseVersionResolver.resolve(course)).thenReturn(version);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId))
                .thenReturn(false);

        enrollmentService.enroll(studentId, courseId);

        ArgumentCaptor<Enrollment> captor = ArgumentCaptor.forClass(Enrollment.class);
        verify(enrollmentRepository).save(captor.capture());
        assertThat(captor.getValue().getCourseVersionId()).isEqualTo(versionId);
    }

    @Test
    void enrollRejectsCourseWithoutApprovedVersion() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Course course = mock(Course.class);
        when(course.getStatus()).thenReturn(CourseStatus.PUBLISHED);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(publishedCourseVersionResolver.resolve(course)).thenThrow(new BusinessException(
                "COURSE_VERSION_NOT_PUBLISHED",
                "Khóa học chưa có phiên bản đã duyệt để ghi danh."));

        assertThatThrownBy(() -> enrollmentService.enroll(studentId, courseId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("phiên bản đã duyệt");
    }
}
