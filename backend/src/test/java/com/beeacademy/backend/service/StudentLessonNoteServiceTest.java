package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentLessonNoteRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentLessonNoteServiceTest {

    @Mock
    private StudentLessonNoteRepository noteRepository;
    @Mock
    private LessonRepository lessonRepository;
    @Mock
    private ProfileRepository profileRepository;
    @Mock
    private EnrollmentRepository enrollmentRepository;

    @InjectMocks
    private StudentLessonNoteService service;

    @Test
    void listNotesAlwaysScopesQueryToAuthenticatedStudent() {
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        allowLessonAccess(courseId, lessonId, studentId);
        when(noteRepository.findByStudent_IdAndLesson_IdOrderByTimeSecAscCreatedAtAsc(
                studentId, lessonId)).thenReturn(List.of());

        var result = service.listNotes(courseId, lessonId, student(studentId));

        assertThat(result).isEmpty();
        verify(noteRepository).findByStudent_IdAndLesson_IdOrderByTimeSecAscCreatedAtAsc(
                studentId, lessonId);
    }

    @Test
    void deleteCannotAccessAnotherStudentsNote() {
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        allowLessonAccess(courseId, lessonId, studentId);
        when(noteRepository.findByIdAndStudent_IdAndLesson_Id(noteId, studentId, lessonId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteNote(
                courseId, lessonId, noteId, student(studentId)))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(noteRepository, never()).delete(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void nonStudentCannotReadLessonNotes() {
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        AuthenticatedUser teacher = new AuthenticatedUser(
                UUID.randomUUID(), "teacher@example.com", "teacher");

        assertThatThrownBy(() -> service.listNotes(courseId, lessonId, teacher))
                .isInstanceOfSatisfying(BusinessException.class, error -> {
                    assertThat(error.getCode()).isEqualTo("STUDENT_NOTE_ROLE_FORBIDDEN");
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });

        verify(lessonRepository, never()).findWithChapterAndCourseById(lessonId);
        verify(noteRepository, never())
                .findByStudent_IdAndLesson_IdOrderByTimeSecAscCreatedAtAsc(
                        teacher.userId(), lessonId);
    }

    private void allowLessonAccess(UUID courseId, UUID lessonId, UUID studentId) {
        Lesson lesson = mock(Lesson.class);
        Chapter chapter = mock(Chapter.class);
        Course course = mock(Course.class);
        when(lesson.getChapter()).thenReturn(chapter);
        when(chapter.getCourse()).thenReturn(course);
        when(course.getId()).thenReturn(courseId);
        when(lessonRepository.findWithChapterAndCourseById(lessonId)).thenReturn(Optional.of(lesson));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
    }

    private AuthenticatedUser student(UUID studentId) {
        return new AuthenticatedUser(studentId, "student@example.com", "student");
    }
}
