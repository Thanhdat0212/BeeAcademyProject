package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SaveStudentLessonNoteRequest;
import com.beeacademy.backend.dto.response.StudentLessonNoteResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.StudentLessonNote;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentLessonNoteRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StudentLessonNoteService {

    private final StudentLessonNoteRepository noteRepository;
    private final LessonRepository lessonRepository;
    private final ProfileRepository profileRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Transactional(readOnly = true)
    public List<StudentLessonNoteResponse> listNotes(UUID courseId, UUID lessonId,
                                                     AuthenticatedUser me) {
        verifyStudentLessonAccess(courseId, lessonId, me);
        return noteRepository
                .findByStudent_IdAndLesson_IdOrderByTimeSecAscCreatedAtAsc(me.userId(), lessonId)
                .stream()
                .map(StudentLessonNoteResponse::fromEntity)
                .toList();
    }

    @Transactional
    public StudentLessonNoteResponse createNote(UUID courseId, UUID lessonId,
                                                AuthenticatedUser me,
                                                SaveStudentLessonNoteRequest request) {
        Lesson lesson = verifyStudentLessonAccess(courseId, lessonId, me);
        Profile student = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        StudentLessonNote saved = noteRepository.saveAndFlush(
                StudentLessonNote.create(student, lesson, request.timeSec(), request.content()));
        return StudentLessonNoteResponse.fromEntity(saved);
    }

    @Transactional
    public StudentLessonNoteResponse updateNote(UUID courseId, UUID lessonId, UUID noteId,
                                                AuthenticatedUser me,
                                                SaveStudentLessonNoteRequest request) {
        verifyStudentLessonAccess(courseId, lessonId, me);
        StudentLessonNote note = loadOwnNote(noteId, lessonId, me.userId());
        note.update(request.timeSec(), request.content());
        return StudentLessonNoteResponse.fromEntity(noteRepository.saveAndFlush(note));
    }

    @Transactional
    public void deleteNote(UUID courseId, UUID lessonId, UUID noteId, AuthenticatedUser me) {
        verifyStudentLessonAccess(courseId, lessonId, me);
        noteRepository.delete(loadOwnNote(noteId, lessonId, me.userId()));
    }

    private Lesson verifyStudentLessonAccess(UUID courseId, UUID lessonId, AuthenticatedUser me) {
        ensureStudentRole(me);
        Lesson lesson = lessonRepository.findWithChapterAndCourseById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));
        if (!lesson.getChapter().getCourse().getId().equals(courseId)) {
            throw new BusinessException(
                    "STUDENT_NOTE_INVALID_LESSON",
                    "Bai hoc khong thuoc khoa hoc da chon.",
                    HttpStatus.BAD_REQUEST
            );
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException(
                    "STUDENT_NOTE_COURSE_FORBIDDEN",
                    "Ban can tham gia khoa hoc de su dung ghi chu.",
                    HttpStatus.FORBIDDEN
            );
        }
        return lesson;
    }

    private StudentLessonNote loadOwnNote(UUID noteId, UUID lessonId, UUID studentId) {
        // Lookup luôn kèm studentId để không làm lộ sự tồn tại của ghi chú học sinh khác.
        return noteRepository.findByIdAndStudent_IdAndLesson_Id(noteId, studentId, lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("StudentLessonNote", noteId));
    }

    private void ensureStudentRole(AuthenticatedUser me) {
        if (me == null || !"student".equalsIgnoreCase(me.role())) {
            throw new BusinessException(
                    "STUDENT_NOTE_ROLE_FORBIDDEN",
                    "Chi hoc sinh moi co the su dung ghi chu bai hoc.",
                    HttpStatus.FORBIDDEN
            );
        }
    }
}
