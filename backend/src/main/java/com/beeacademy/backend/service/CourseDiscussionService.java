package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateCourseDiscussionReplyRequest;
import com.beeacademy.backend.dto.request.CreateCourseDiscussionThreadRequest;
import com.beeacademy.backend.dto.response.CourseDiscussionThreadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDiscussionThread;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseDiscussionThreadRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseDiscussionService {

    private final CourseDiscussionThreadRepository threadRepository;
    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final ProfileRepository profileRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Transactional(readOnly = true)
    public List<CourseDiscussionThreadResponse> listThreads(UUID courseId, AuthenticatedUser me) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        return threadRepository.findByCourseIdDetailed(courseId).stream()
                .map(CourseDiscussionThreadResponse::fromEntity)
                .toList();
    }

    @Transactional
    public CourseDiscussionThreadResponse createThread(UUID courseId, AuthenticatedUser me,
                                                       CreateCourseDiscussionThreadRequest req) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        Profile author = loadProfile(me.userId());

        Lesson lesson = null;
        if (req.lessonId() != null) {
            lesson = lessonRepository.findWithChapterAndCourseById(req.lessonId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lesson", req.lessonId()));
            if (!lesson.getChapter().getCourse().getId().equals(course.getId())) {
                throw new BusinessException("INVALID_LESSON",
                        "Bài học không thuộc khóa học đã chọn.");
            }
        }

        CourseDiscussionThread saved = threadRepository.saveAndFlush(
                CourseDiscussionThread.create(course, lesson, author, req.content()));
        return CourseDiscussionThreadResponse.fromEntity(saved);
    }

    @Transactional
    public CourseDiscussionThreadResponse addReply(UUID courseId, UUID threadId,
                                                   AuthenticatedUser me,
                                                   CreateCourseDiscussionReplyRequest req) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = threadRepository.findDetailedById(threadId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseDiscussionThread", threadId));
        if (!thread.getCourse().getId().equals(course.getId())) {
            throw new BusinessException("INVALID_THREAD",
                    "Câu hỏi không thuộc khóa học đã chọn.");
        }

        Profile author = loadProfile(me.userId());
        thread.addReply(author, req.content());
        return CourseDiscussionThreadResponse.fromEntity(threadRepository.saveAndFlush(thread));
    }

    private Course loadCourse(UUID courseId) {
        return courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
    }

    private Profile loadProfile(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));
    }

    private void verifyCourseAccess(Course course, AuthenticatedUser me) {
        if (me == null) {
            throw new BusinessException("UNAUTHORIZED",
                    "Vui lòng đăng nhập để xem thảo luận khóa học.",
                    HttpStatus.UNAUTHORIZED);
        }

        Profile profile = loadProfile(me.userId());
        UserRole role = profile.getRole();
        if (role == UserRole.ADMIN) {
            return;
        }
        if (role == UserRole.TEACHER
                && course.getTeacher() != null
                && course.getTeacher().getId().equals(me.userId())) {
            return;
        }
        if (role == UserRole.STUDENT
                && enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), course.getId())) {
            return;
        }

        throw new BusinessException("FORBIDDEN",
                "Bạn cần có quyền truy cập khóa học để tham gia thảo luận.",
                HttpStatus.FORBIDDEN);
    }
}
