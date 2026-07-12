package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateCourseDiscussionReplyRequest;
import com.beeacademy.backend.dto.request.CreateCourseDiscussionThreadRequest;
import com.beeacademy.backend.dto.request.UpdateCourseDiscussionContentRequest;
import com.beeacademy.backend.dto.response.CourseDiscussionThreadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDiscussionReply;
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
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseDiscussionService {

    private static final long MAX_QA_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_MIME = Set.of(
            "image/png", "image/jpeg", "image/webp");

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
        validateAttachment(me.userId(), req.attachmentUrl(), req.attachmentType(),
                req.attachmentSizeBytes());

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
                CourseDiscussionThread.create(course, lesson, author, req.content(),
                        req.attachmentUrl(), req.attachmentName(),
                        req.attachmentType(), req.attachmentSizeBytes()));
        return CourseDiscussionThreadResponse.fromEntity(saved);
    }

    @Transactional
    public CourseDiscussionThreadResponse addReply(UUID courseId, UUID threadId,
                                                   AuthenticatedUser me,
                                                   CreateCourseDiscussionReplyRequest req) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = loadThreadInCourse(course, threadId);

        Profile author = loadProfile(me.userId());
        validateAttachment(me.userId(), req.attachmentUrl(), req.attachmentType(),
                req.attachmentSizeBytes());
        thread.addReply(author, req.content(), req.attachmentUrl(), req.attachmentName(),
                req.attachmentType(), req.attachmentSizeBytes());
        return CourseDiscussionThreadResponse.fromEntity(threadRepository.saveAndFlush(thread));
    }

    @Transactional
    public CourseDiscussionThreadResponse updateThread(UUID courseId, UUID threadId,
                                                       AuthenticatedUser me,
                                                       UpdateCourseDiscussionContentRequest req) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = loadThreadInCourse(course, threadId);
        if (!isAuthor(thread.getAuthor(), me)) {
            throw forbiddenManageDiscussion();
        }

        thread.updateContent(req.content());
        return CourseDiscussionThreadResponse.fromEntity(threadRepository.saveAndFlush(thread));
    }

    @Transactional
    public void deleteThread(UUID courseId, UUID threadId, AuthenticatedUser me) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = loadThreadInCourse(course, threadId);
        if (!isAuthor(thread.getAuthor(), me) && !canManageCourseDiscussion(course, me)) {
            throw forbiddenManageDiscussion();
        }

        threadRepository.deleteRepliesByThreadId(thread.getId());
        threadRepository.deleteThreadByIdDirect(thread.getId());
    }

    @Transactional
    public CourseDiscussionThreadResponse updateReply(UUID courseId, UUID threadId, UUID replyId,
                                                      AuthenticatedUser me,
                                                      UpdateCourseDiscussionContentRequest req) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = loadThreadInCourse(course, threadId);
        CourseDiscussionReply reply = loadReply(thread, replyId);
        if (!isAuthor(reply.getAuthor(), me)) {
            throw forbiddenManageDiscussion();
        }

        reply.updateContent(req.content());
        thread.touchLastActivity();
        return CourseDiscussionThreadResponse.fromEntity(threadRepository.saveAndFlush(thread));
    }

    @Transactional
    public CourseDiscussionThreadResponse deleteReply(UUID courseId, UUID threadId, UUID replyId,
                                                      AuthenticatedUser me) {
        Course course = loadCourse(courseId);
        verifyCourseAccess(course, me);
        CourseDiscussionThread thread = loadThreadInCourse(course, threadId);
        CourseDiscussionReply reply = loadReply(thread, replyId);
        if (!isAuthor(reply.getAuthor(), me) && !canManageCourseDiscussion(course, me)) {
            throw forbiddenManageDiscussion();
        }

        thread.removeReply(reply);
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

    private CourseDiscussionThread loadThreadInCourse(Course course, UUID threadId) {
        CourseDiscussionThread thread = threadRepository.findDetailedById(threadId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseDiscussionThread", threadId));
        if (!thread.getCourse().getId().equals(course.getId())) {
            throw new BusinessException("INVALID_THREAD",
                    "Câu hỏi không thuộc khóa học đã chọn.");
        }
        return thread;
    }

    private CourseDiscussionReply loadReply(CourseDiscussionThread thread, UUID replyId) {
        CourseDiscussionReply reply = thread.findReply(replyId);
        if (reply == null) {
            throw new ResourceNotFoundException("CourseDiscussionReply", replyId);
        }
        return reply;
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

    private boolean isAuthor(Profile author, AuthenticatedUser me) {
        return author != null && me != null && author.getId().equals(me.userId());
    }

    private boolean canManageCourseDiscussion(Course course, AuthenticatedUser me) {
        Profile profile = loadProfile(me.userId());
        UserRole role = profile.getRole();
        return role == UserRole.ADMIN
                || (role == UserRole.TEACHER
                && course.getTeacher() != null
                && course.getTeacher().getId().equals(me.userId()));
    }

    private BusinessException forbiddenManageDiscussion() {
        return new BusinessException("FORBIDDEN",
                "Bạn không có quyền chỉnh sửa hoặc xóa nội dung hỏi đáp này.",
                HttpStatus.FORBIDDEN);
    }

    private void validateAttachment(UUID userId, String url, String contentType, Long sizeBytes) {
        if (url == null || url.isBlank()) return;
        String expectedPath = "/storage/v1/object/public/course-docs/qa-images/" + userId + "/";
        if (contentType == null || !ALLOWED_IMAGE_MIME.contains(contentType)
                || sizeBytes == null || sizeBytes <= 0 || sizeBytes > MAX_QA_IMAGE_BYTES
                || !url.contains(expectedPath)) {
            throw new BusinessException("INVALID_ATTACHMENT",
                    "Ảnh đính kèm không hợp lệ.", HttpStatus.BAD_REQUEST);
        }
    }
}
