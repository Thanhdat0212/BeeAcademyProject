package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQaMessageRequest;
import com.beeacademy.backend.dto.request.CreateQaThreadRequest;
import com.beeacademy.backend.dto.response.QaThreadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaThread;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QaService {

    private final QaThreadRepository qaThreadRepository;
    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listStudentThreads(AuthenticatedUser me) {
        return qaThreadRepository.findStudentThreads(me.userId()).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listTeacherThreads(AuthenticatedUser me) {
        return qaThreadRepository.findTeacherThreads(me.userId()).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional
    public QaThreadResponse createStudentThread(AuthenticatedUser me, CreateQaThreadRequest req) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);

        Course course = courseRepository.findWithCategoryAndTeacherById(req.courseId())
                .orElseThrow(() -> new ResourceNotFoundException("Course", req.courseId()));
        if (course.getTeacher() == null) {
            throw new BusinessException("COURSE_TEACHER_MISSING",
                    "Khóa học này chưa được gán giáo viên để nhận câu hỏi.",
                    HttpStatus.CONFLICT);
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), course.getId())) {
            throw new BusinessException("NOT_ENROLLED",
                    "Bạn cần ghi danh khóa học trước khi đặt câu hỏi.",
                    HttpStatus.FORBIDDEN);
        }

        Lesson lesson = null;
        if (req.lessonId() != null) {
            lesson = lessonRepository.findWithChapterAndCourseById(req.lessonId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lesson", req.lessonId()));
            if (!lesson.getChapter().getCourse().getId().equals(course.getId())) {
                throw new BusinessException("INVALID_LESSON",
                        "Bài học không thuộc khóa học đã chọn.");
            }
        }

        QaThread saved = qaThreadRepository.saveAndFlush(
                QaThread.create(student, course, lesson, req.content()));
        return QaThreadResponse.fromEntity(saved);
    }

    @Transactional
    public QaThreadResponse addStudentMessage(UUID threadId, AuthenticatedUser me,
                                              CreateQaMessageRequest req) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);
        QaThread thread = loadThread(threadId);
        if (!thread.getStudent().getId().equals(me.userId())) {
            throwForbidden();
        }
        thread.addStudentMessage(student, req.content());
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    @Transactional
    public QaThreadResponse addTeacherMessage(UUID threadId, AuthenticatedUser me,
                                              CreateQaMessageRequest req) {
        Profile teacher = loadProfile(me.userId());
        assertRole(teacher, UserRole.TEACHER);
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        thread.addTeacherMessage(teacher, req.content());
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    @Transactional
    public QaThreadResponse updateTeacherStatus(UUID threadId, AuthenticatedUser me,
                                                boolean resolved) {
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        if (resolved) {
            thread.resolve();
        } else {
            thread.reopen();
        }
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    private QaThread loadThread(UUID threadId) {
        return qaThreadRepository.findDetailedById(threadId)
                .orElseThrow(() -> new ResourceNotFoundException("QaThread", threadId));
    }

    private Profile loadProfile(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));
    }

    private void verifyTeacherOwner(QaThread thread, UUID teacherId) {
        if (!thread.getCourse().getTeacher().getId().equals(teacherId)) {
            throwForbidden();
        }
    }

    private void assertRole(Profile profile, UserRole expected) {
        if (profile.getRole() != expected) {
            throwForbidden();
        }
    }

    private void throwForbidden() {
        throw new BusinessException("FORBIDDEN",
                "Bạn không có quyền thực hiện thao tác này.",
                HttpStatus.FORBIDDEN);
    }
}
