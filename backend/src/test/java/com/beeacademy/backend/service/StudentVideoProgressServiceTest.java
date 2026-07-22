package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.learning.VideoWatchedSegment;
import com.beeacademy.backend.dto.request.SaveStudentVideoProgressRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.StudentVideoProgress;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentVideoProgressServiceTest {

    @Mock private StudentVideoProgressRepository progressRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private CourseProgressItemRepository courseProgressItemRepository;
    @Mock private CourseProgressService courseProgressService;

    private StudentVideoProgressService service;

    @BeforeEach
    void setUp() {
        service = new StudentVideoProgressService(
                progressRepository,
                lessonRepository,
                profileRepository,
                enrollmentRepository,
                courseProgressItemRepository,
                courseProgressService,
                new ObjectMapper());
    }

    @Test
    void mergesUniqueSegmentsClampsBoundsAndCompletesOnlyAtNinetyPercent() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        AuthenticatedUser me = new AuthenticatedUser(studentId, "student@example.com", "student");
        Profile student = org.mockito.Mockito.mock(Profile.class);
        Course course = org.mockito.Mockito.mock(Course.class);
        Chapter chapter = org.mockito.Mockito.mock(Chapter.class);
        Lesson lesson = org.mockito.Mockito.mock(Lesson.class);
        when(course.getId()).thenReturn(courseId);
        when(chapter.getCourse()).thenReturn(course);
        when(lesson.getId()).thenReturn(lessonId);
        when(lesson.getChapter()).thenReturn(chapter);
        when(lesson.getVideoUrl()).thenReturn("https://cdn.example/video.mp4");
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(lessonRepository.findWithChapterAndCourseById(lessonId)).thenReturn(Optional.of(lesson));

        StudentVideoProgress existing = StudentVideoProgress.create(
                student, lesson, 40, 100, "[{\"startSec\":0,\"endSec\":40}]");
        when(progressRepository.findByStudent_IdAndLesson_Id(studentId, lessonId))
                .thenReturn(Optional.of(existing));
        when(progressRepository.saveAndFlush(any(StudentVideoProgress.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(courseProgressItemRepository
                .existsByStudentIdAndCourseIdAndItemIdAndItemType(
                        studentId, courseId, lessonId, "lesson"))
                .thenReturn(false);

        var beforeThreshold = service.saveProgress(
                courseId, lessonId, me,
                new SaveStudentVideoProgressRequest(
                        100, 100,
                        List.of(
                                new VideoWatchedSegment(30, 70),
                                new VideoWatchedSegment(90, 120))));

        assertThat(beforeThreshold.watchedSegments()).containsExactly(
                new VideoWatchedSegment(0, 70),
                new VideoWatchedSegment(90, 100));
        assertThat(beforeThreshold.watchedDurationSec()).isEqualTo(80);
        assertThat(beforeThreshold.completed()).isFalse();
        verify(courseProgressService, never())
                .completeVideoLessonAfterWatch(any(), any(), any());

        var completed = service.saveProgress(
                courseId, lessonId, me,
                new SaveStudentVideoProgressRequest(
                        100, 100,
                        List.of(new VideoWatchedSegment(70, 90))));

        assertThat(completed.watchedSegments())
                .containsExactly(new VideoWatchedSegment(0, 100));
        assertThat(completed.watchedDurationSec()).isEqualTo(100);
        assertThat(completed.completed()).isTrue();
        verify(courseProgressService).completeVideoLessonAfterWatch(courseId, lessonId, me);
    }

    @Test
    void rejectsSavingProgressForStudentWithoutEnrollment() {
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(false);

        assertThatThrownBy(() -> service.saveProgress(
                courseId,
                lessonId,
                new AuthenticatedUser(studentId, "student@example.com", "student"),
                new SaveStudentVideoProgressRequest(5, 100, List.of())))
                .isInstanceOfSatisfying(BusinessException.class, error ->
                        assertThat(error.getCode())
                                .isEqualTo("STUDENT_VIDEO_PROGRESS_COURSE_FORBIDDEN"));

        verify(progressRepository, never()).saveAndFlush(any());
    }
}
