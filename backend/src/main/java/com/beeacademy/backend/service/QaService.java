package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.request.CreateQaMessageRequest;
import com.beeacademy.backend.dto.request.CreateQaThreadRequest;
import com.beeacademy.backend.dto.response.QaKpiReportResponse;
import com.beeacademy.backend.dto.response.QaThreadResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaMessage;
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
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QaService {

    private static final String QA_IMAGE_BUCKET = "course-docs";
    private static final long MAX_QA_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_IMAGE_MIME = Set.of(
            "image/png", "image/jpeg", "image/webp");

    private final QaThreadRepository qaThreadRepository;
    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserNotificationService notificationService;
    private final ParentTeacherMessageEmailService parentTeacherMessageEmailService;
    private final SupabaseStorageClient storageClient;
    private final TeacherAccessService teacherAccessService;

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listStudentThreads(AuthenticatedUser me) {
        return qaThreadRepository.findStudentThreads(me.userId()).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listCoursePublicThreads(UUID courseId, AuthenticatedUser me) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);
        courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        requireEnrollment(me.userId(), courseId);
        return qaThreadRepository.findPublicThreadsByCourseId(courseId).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public QaThreadResponse getStudentThread(UUID threadId, AuthenticatedUser me) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);
        QaThread thread = loadThread(threadId);
        boolean isOwner = thread.getStudent().getId().equals(me.userId());
        boolean canViewPublic = "public".equals(thread.getVisibility())
                && enrollmentRepository.existsByStudentIdAndCourseId(
                        me.userId(), thread.getCourse().getId());
        if (!isOwner && !canViewPublic) {
            throwForbidden();
        }
        return QaThreadResponse.fromEntity(thread);
    }

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listAdminThreads(UUID courseId, AuthenticatedUser me) {
        Profile admin = loadProfile(me.userId());
        assertRole(admin, UserRole.ADMIN);
        if (courseId != null) {
            courseRepository.findById(courseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        }
        return qaThreadRepository.findAdminThreads(courseId).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public QaThreadResponse getAdminThread(UUID threadId, AuthenticatedUser me) {
        Profile admin = loadProfile(me.userId());
        assertRole(admin, UserRole.ADMIN);
        return QaThreadResponse.fromEntity(loadThread(threadId));
    }

    @Transactional(readOnly = true)
    public List<QaThreadResponse> listTeacherThreads(AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        return qaThreadRepository.findTeacherThreads(me.userId()).stream()
                .map(QaThreadResponse::fromEntity)
                .toList();
    }

    @Transactional
    public QaThreadResponse createStudentThread(AuthenticatedUser me, CreateQaThreadRequest req) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);
        String title = normalizeQuestionTitle(req.title());
        String content = normalizeQuestionContent(req.content());
        validateAttachment(me.userId(), req.attachmentUrl(), req.attachmentType(),
                req.attachmentSizeBytes());

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
                QaThread.createStudentQuestion(student, course, lesson, title, content,
                        req.attachmentUrl(), req.attachmentName(),
                        req.attachmentType(), req.attachmentSizeBytes(),
                        normalizeVisibility(req.visibility())));
        notifyTeacherAboutNewQuestion(saved);
        return QaThreadResponse.fromEntity(saved);
    }

    @Transactional
    public QaThreadResponse addStudentMessage(UUID threadId, AuthenticatedUser me,
                                              CreateQaMessageRequest req) {
        Profile student = loadProfile(me.userId());
        assertRole(student, UserRole.STUDENT);
        validateAttachment(me.userId(), req.attachmentUrl(), req.attachmentType(),
                req.attachmentSizeBytes());
        QaThread thread = loadThread(threadId);
        if (!thread.getStudent().getId().equals(me.userId())) {
            throwForbidden();
        }
        thread.addStudentMessage(student, req.content(),
                req.attachmentUrl(), req.attachmentName(),
                req.attachmentType(), req.attachmentSizeBytes());
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    @Transactional
    public QaThreadResponse addTeacherMessage(UUID threadId, AuthenticatedUser me,
                                              CreateQaMessageRequest req) {
        Profile teacher = loadProfile(me.userId());
        teacherAccessService.requireApprovedTeacher(me, teacher);
        assertRole(teacher, UserRole.TEACHER);
        validateAttachment(me.userId(), req.attachmentUrl(), req.attachmentType(),
                req.attachmentSizeBytes());
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        thread.addTeacherMessage(teacher, req.content(),
                req.attachmentUrl(), req.attachmentName(),
                req.attachmentType(), req.attachmentSizeBytes());
        QaThread saved = qaThreadRepository.saveAndFlush(thread);
        notifyStudentAboutTeacherReply(saved, teacher);
        notifyParentsAboutTeacherReply(saved, teacher, req.content());
        return QaThreadResponse.fromEntity(saved);
    }

    @Transactional
    public QaThreadResponse editTeacherMessage(UUID threadId, UUID messageId,
                                               AuthenticatedUser me,
                                               CreateQaMessageRequest req) {
        teacherAccessService.requireApprovedTeacher(me);
        loadProfile(me.userId());
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        QaMessage message = thread.getMessages().stream()
                .filter(m -> m.getId().equals(messageId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("QaMessage", messageId));
        if (message.getAuthorRole() != UserRole.TEACHER
                || !message.getAuthor().getId().equals(me.userId())) {
            throwForbidden();
        }
        message.updateContent(req.content());
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    @Transactional
    public QaThreadResponse markDuplicate(UUID threadId, UUID duplicateOfThreadId,
                                          AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        QaThread duplicateOf = loadThread(duplicateOfThreadId);
        verifyTeacherOwner(duplicateOf, me.userId());
        if (!thread.getCourse().getId().equals(duplicateOf.getCourse().getId())) {
            throw new BusinessException("DUPLICATE_COURSE_MISMATCH",
                    "Chỉ có thể đánh dấu trùng lặp trong cùng một khóa học.",
                    HttpStatus.BAD_REQUEST);
        }
        if (thread.getId().equals(duplicateOfThreadId)) {
            throw new BusinessException("DUPLICATE_SELF",
                    "Không thể đánh dấu câu hỏi trùng với chính nó.",
                    HttpStatus.BAD_REQUEST);
        }
        thread.markDuplicate(duplicateOfThreadId);
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    @Transactional(readOnly = true)
    public QaKpiReportResponse getTeacherKpiReport(AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        List<QaThread> threads = qaThreadRepository.findTeacherThreads(me.userId());
        long totalAnswered = 0;
        long within48Hours = 0;
        long within7Days = 0;
        for (QaThread thread : threads) {
            Instant createdAt = thread.getCreatedAt();
            Instant firstTeacherReplyAt = thread.getMessages().stream()
                    .filter(message -> message.getAuthorRole() == UserRole.TEACHER)
                    .map(QaMessage::getCreatedAt)
                    .filter(java.util.Objects::nonNull)
                    .min(Instant::compareTo)
                    .orElse(null);
            if (createdAt == null || firstTeacherReplyAt == null) {
                continue;
            }
            totalAnswered++;
            Duration elapsed = Duration.between(createdAt, firstTeacherReplyAt);
            if (!elapsed.minusHours(48).isNegative() && !elapsed.minusHours(48).isZero()) {
                // elapsed > 48h
            } else {
                within48Hours++;
            }
            if (!elapsed.minusDays(7).isNegative() && !elapsed.minusDays(7).isZero()) {
                // elapsed > 7d
            } else {
                within7Days++;
            }
        }
        return new QaKpiReportResponse(
                totalAnswered,
                within48Hours,
                within7Days,
                ratio(within48Hours, totalAnswered),
                ratio(within7Days, totalAnswered));
    }

    @Transactional
    public QaThreadResponse updateTeacherStatus(UUID threadId, AuthenticatedUser me,
                                                boolean resolved) {
        teacherAccessService.requireApprovedTeacher(me);
        QaThread thread = loadThread(threadId);
        verifyTeacherOwner(thread, me.userId());
        if (resolved) {
            thread.resolve();
        } else {
            thread.reopen();
        }
        return QaThreadResponse.fromEntity(qaThreadRepository.saveAndFlush(thread));
    }

    public UploadResponse uploadImage(AuthenticatedUser me, MultipartFile file) {
        Profile profile = loadProfile(me.userId());
        if (profile.getRole() != UserRole.STUDENT && profile.getRole() != UserRole.TEACHER) {
            throwForbidden();
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui lòng chọn ảnh.");
        }
        if (file.getSize() > MAX_QA_IMAGE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "Ảnh đính kèm tối đa 5 MB.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_MIME.contains(contentType)) {
            throw new BusinessException("UNSUPPORTED_FILE_TYPE",
                    "Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP.", HttpStatus.BAD_REQUEST);
        }

        String extension = switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
        String path = "qa-images/" + me.userId() + "/" + UUID.randomUUID() + extension;
        String publicUrl = storageClient.upload(QA_IMAGE_BUCKET, path, contentType,
                file.getResource(), file.getSize());
        return new UploadResponse(path, publicUrl, contentType, file.getSize());
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

    private void requireEnrollment(UUID studentId, UUID courseId) {
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new BusinessException("NOT_ENROLLED",
                    "Bạn cần ghi danh khóa học trước khi xem hoặc đặt câu hỏi.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void notifyTeacherAboutNewQuestion(QaThread thread) {
        Profile teacher = thread.getCourse().getTeacher();
        notificationService.notify(
                teacher.getId(),
                "qa_new_student_question",
                "Câu hỏi mới từ học sinh",
                displayName(thread.getStudent(), "Học sinh") + " đã đặt câu hỏi \""
                        + excerpt(thread.getTitle()) + "\" trong khóa "
                        + thread.getCourse().getTitle() + ".",
                "/teacher/qa");
    }

    private void notifyParentsAboutTeacherReply(QaThread thread, Profile teacher, String content) {
        Map<UUID, Profile> parents = new LinkedHashMap<>();
        thread.getMessages().stream()
                .filter(message -> message.getAuthorRole() == UserRole.PARENT)
                .forEach(message -> parents.putIfAbsent(message.getAuthor().getId(), message.getAuthor()));
        if (parents.isEmpty()) return;

        String teacherName = displayName(teacher, "Giáo viên");
        String studentName = displayName(thread.getStudent(), "học sinh");
        String courseTitle = thread.getCourse().getTitle();
        for (Profile parent : parents.values()) {
            notificationService.notify(
                    parent.getId(),
                    "parent_teacher_reply",
                    "Giáo viên đã phản hồi",
                    "%s đã phản hồi về %s trong khóa %s."
                            .formatted(teacherName, studentName, courseTitle),
                    "/parent/messages");
            parentTeacherMessageEmailService.notifyParent(
                    parent.getId(),
                    displayName(parent, "Phụ huynh"),
                    teacherName,
                    studentName,
                    courseTitle,
                    excerpt(content));
        }
    }

    private void notifyStudentAboutTeacherReply(QaThread thread, Profile teacher) {
        notificationService.notify(
                thread.getStudent().getId(),
                "qa_teacher_reply",
                "Giáo viên đã trả lời câu hỏi",
                displayName(teacher, "Giáo viên") + " đã trả lời câu hỏi trong khóa "
                        + thread.getCourse().getTitle() + ".",
                "/student/qa");
    }

    private double ratio(long numerator, long denominator) {
        if (denominator == 0) return 0.0;
        return Math.round((numerator * 10000.0 / denominator)) / 100.0;
    }

    private String displayName(Profile profile, String fallback) {
        return profile.getFullName() == null || profile.getFullName().isBlank()
                ? fallback
                : profile.getFullName();
    }

    private String excerpt(String content) {
        if (content == null || content.isBlank()) return "Tin nhắn mới";
        String trimmed = content.trim();
        return trimmed.length() <= 180 ? trimmed : trimmed.substring(0, 177) + "...";
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

    private void throwForbidden() {
        throw new BusinessException("FORBIDDEN",
                "Bạn không có quyền thực hiện thao tác này.",
                HttpStatus.FORBIDDEN);
    }

    private String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "public";
        }
        String normalized = visibility.trim().toLowerCase();
        if (!"public".equals(normalized) && !"private".equals(normalized)) {
            throw new BusinessException("INVALID_QA_VISIBILITY",
                    "Phạm vi hiển thị câu hỏi chỉ chấp nhận public hoặc private.",
                    HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeQuestionTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new BusinessException("QA_TITLE_REQUIRED",
                    "Vui lòng nhập tiêu đề câu hỏi.", HttpStatus.BAD_REQUEST);
        }
        String normalized = title.trim();
        if (normalized.length() > 180) {
            throw new BusinessException("QA_TITLE_TOO_LONG",
                    "Tiêu đề câu hỏi tối đa 180 ký tự.", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeQuestionContent(String content) {
        if (content == null || content.trim().length() < 10) {
            throw new BusinessException("QA_CONTENT_TOO_SHORT",
                    "Nội dung câu hỏi phải có ít nhất 10 ký tự.", HttpStatus.BAD_REQUEST);
        }
        return content.trim();
    }
}
