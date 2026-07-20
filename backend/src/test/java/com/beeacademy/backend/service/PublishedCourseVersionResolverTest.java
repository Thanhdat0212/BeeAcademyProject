package com.beeacademy.backend.service;

import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublishedCourseVersionResolverTest {

    @Mock CourseRepository courseRepository;
    @Mock CourseVersionRepository courseVersionRepository;
    @Mock ChapterRepository chapterRepository;
    @Mock QuizConfigRepository quizConfigRepository;
    @Mock ExamConfigVersionService examConfigVersionService;

    @Test
    void publishedLegacyCourseGetsApprovedSnapshot() {
        UUID courseId = UUID.randomUUID();
        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getSubmittedVersionNo()).thenReturn(0, 1);
        when(course.getStatus()).thenReturn(CourseStatus.PUBLISHED);
        when(course.getTitle()).thenReturn("Legacy course");
        when(courseVersionRepository.findByCourseIdAndVersionNo(courseId, 0))
                .thenReturn(Optional.empty());
        when(courseVersionRepository
                .findFirstByCourseIdAndApprovedAtIsNotNullOrderByVersionNoDesc(courseId))
                .thenReturn(Optional.empty());
        when(courseVersionRepository.findMaxVersionNo(courseId)).thenReturn(0);
        when(chapterRepository.findWithLessonsByCourseId(courseId)).thenReturn(List.of());
        when(quizConfigRepository.findByCourseIds(List.of(courseId))).thenReturn(List.of());
        when(examConfigVersionService.ensureDraftSet(courseId)).thenReturn(List.of());
        when(courseVersionRepository.save(any(CourseVersion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PublishedCourseVersionResolver resolver = new PublishedCourseVersionResolver(
                courseRepository,
                courseVersionRepository,
                chapterRepository,
                quizConfigRepository,
                examConfigVersionService,
                new ObjectMapper());

        CourseVersion resolved = resolver.resolve(course);

        assertThat(resolved.getVersionNo()).isEqualTo(1);
        assertThat(resolved.isApproved()).isTrue();
        assertThat(resolved.getSnapshotJson()).contains("quizChapterIds", "requiredExams");
        verify(course).markSubmittedVersion(1);
        verify(courseRepository).save(course);
    }
}
