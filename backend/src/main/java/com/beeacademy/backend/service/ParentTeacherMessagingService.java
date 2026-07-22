package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.response.ParentTeacherConversationResponse;
import com.beeacademy.backend.dto.response.QaMessageResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaMessage;
import com.beeacademy.backend.model.QaThread;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentTeacherMessagingService {

    private static final String PARENT_MESSAGE_BUCKET = "course-docs";
    private static final long MAX_PARENT_ATTACHMENT_BYTES = 20L * 1024 * 1024;
    private static final int MAX_PARENT_TEACHER_MESSAGE_LENGTH = 2000;
    private static final Set<String> ALLOWED_ATTACHMENT_MIME = Set.of(
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain"
    );

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final QaThreadRepository qaThreadRepository;
    private final SupabaseStorageClient storageClient;
    private final UserNotificationService notificationService;
    private final ParentTeacherMessageEmailService parentTeacherMessageEmailService;


    @Transactional(readOnly = true)
    public List<ParentTeacherConversationResponse> getChildTeacherConversations(
            AuthenticatedUser me,
            UUID studentId) {
        log.info("Parent {} requested teacher conversations for student {}", me.userId(), studentId);

        Profile student = requireLinkedStudent(me, studentId);
        List<Course> enrolledCourses = courseRepository.findEnrolledByStudentId(studentId).stream()
                .filter(course -> course.getTeacher() != null)
                .toList();
        if (enrolledCourses.isEmpty()) {
            return List.of();
        }

        Map<UUID, QaThread> latestParentThreadByCourseId = qaThreadRepository
                .findParentThreadsForStudent(me.userId(), studentId)
                .stream()
                .collect(Collectors.toMap(
                        thread -> thread.getCourse().getId(),
                        Function.identity(),
                        (newer, older) -> newer,
                        LinkedHashMap::new));

        return enrolledCourses.stream()
                .map(course -> toParentTeacherConversation(
                        student,
                        course,
                        latestParentThreadByCourseId.get(course.getId())))
                .toList();
    }

    @Transactional
    public ParentTeacherConversationResponse sendParentTeacherMessage(
            AuthenticatedUser me,
            UUID studentId,
            SendParentTeacherMessageRequest request) {
        log.info("Parent {} sent teacher message for student {} and course {}",
                me.userId(), studentId, request.courseId());

        Profile parent = requireParentProfile(me.userId());
        if (parent.getRole() != UserRole.PARENT) {
            throwForbidden();
        }
        Profile student = requireLinkedStudent(me, studentId);

        Course course = courseRepository.findWithCategoryAndTeacherById(request.courseId())
                .orElseThrow(() -> new ResourceNotFoundException("Course", request.courseId()));
        if (course.getTeacher() == null) {
            throw new BusinessException(
                    "COURSE_TEACHER_MISSING",
                    "Khóa học này chưa được gán giáo viên để nhận tin nhắn.",
                    HttpStatus.CONFLICT);
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, course.getId())) {
            throw new BusinessException(
                    "NOT_ENROLLED",
                    "Con chưa ghi danh khóa học này nên phụ huynh chưa thể nhắn giáo viên.",
                    HttpStatus.FORBIDDEN);
        }

        List<QaThread> existingThreads = qaThreadRepository
                .findParentThreadsForCourse(me.userId(), studentId, course.getId());
        validateParentTeacherMessageContent(request.content());
        validateAttachmentMetadata(request.attachmentUrl(), request.attachmentSizeBytes());
        QaThread thread;
        if (existingThreads.isEmpty()) {
            thread = QaThread.createWithAuthor(
                    student,
                    course,
                    null,
                    parent,
                    request.content(),
                    request.attachmentUrl(),
                    request.attachmentName(),
                    request.attachmentType(),
                    request.attachmentSizeBytes(),
                    "private");
        } else {
            thread = existingThreads.get(0);
            thread.addParentMessage(
                    parent,
                    request.content(),
                    request.attachmentUrl(),
                    request.attachmentName(),
                    request.attachmentType(),
                    request.attachmentSizeBytes());
        }

        QaThread saved = qaThreadRepository.saveAndFlush(thread);
        notifyTeacherAboutParentMessage(parent, student, course, request.content());
        return toParentTeacherConversation(student, course, saved);
    }

    public UploadResponse uploadMessageAttachment(AuthenticatedUser me, MultipartFile file) {
        Profile parent = requireParentProfile(me.userId());
        if (parent.getRole() != UserRole.PARENT) {
            throwForbidden();
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui lòng chọn file đính kèm.");
        }
        if (file.getSize() > MAX_PARENT_ATTACHMENT_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "File đính kèm tối đa 20MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_ATTACHMENT_MIME.contains(contentType)) {
            throw new BusinessException(
                    "UNSUPPORTED_FILE_TYPE",
                    "Chỉ hỗ trợ PDF, ảnh, Word, PowerPoint hoặc text.",
                    HttpStatus.BAD_REQUEST);
        }

        String originalName = file.getOriginalFilename();
        String ext = extensionOf(originalName, contentType);
        String path = "parent-messages/" + me.userId() + "/" + UUID.randomUUID() + ext;
        try {
            String publicUrl = storageClient.upload(
                    PARENT_MESSAGE_BUCKET,
                    path,
                    contentType,
                    file.getResource(),
                    file.getSize());
            return new UploadResponse(path, publicUrl, contentType, file.getSize());
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(
                    "UPLOAD_FAILED",
                    "Không thể tải file đính kèm. Vui lòng thử lại.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private void notifyTeacherAboutParentMessage(Profile parent, Profile student, Course course, String content) {
        Profile teacher = course.getTeacher();
        String title = "Phụ huynh gửi tin nhắn mới";
        String body = "%s gửi tin nhắn về %s trong khóa %s."
                .formatted(displayName(parent, "Phụ huynh"), displayName(student, "học sinh"), course.getTitle());
        notificationService.notify(teacher.getId(), "parent_teacher_message", title, body, "/teacher/qa");
        parentTeacherMessageEmailService.notifyTeacher(
                teacher.getId(),
                displayName(teacher, "Giáo viên"),
                displayName(parent, "Phụ huynh"),
                displayName(student, "học sinh"),
                course.getTitle(),
                excerpt(content));
    }

    private void validateAttachmentMetadata(String attachmentUrl, Long attachmentSizeBytes) {
        if (attachmentUrl == null || attachmentUrl.isBlank()) return;
        if (attachmentSizeBytes != null && attachmentSizeBytes > MAX_PARENT_ATTACHMENT_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "File đính kèm tối đa 20MB.");
        }
    }

    private void validateParentTeacherMessageContent(String content) {
        QaMessage.requireAllowedContent(content, MAX_PARENT_TEACHER_MESSAGE_LENGTH);
    }

    private String extensionOf(String filename, String contentType) {
        if (filename != null) {
            int dot = filename.lastIndexOf('.');
            if (dot >= 0 && dot < filename.length() - 1) {
                return filename.substring(dot).toLowerCase();
            }
        }
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "application/msword" -> ".doc";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx";
            case "application/vnd.ms-powerpoint" -> ".ppt";
            case "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> ".pptx";
            default -> ".txt";
        };
    }

    private String excerpt(String content) {
        if (content == null || content.isBlank()) return "Tin nhắn mới";
        String trimmed = content.trim();
        return trimmed.length() <= 180 ? trimmed : trimmed.substring(0, 177) + "...";
    }

    private ParentTeacherConversationResponse toParentTeacherConversation(
            Profile student,
            Course course,
            QaThread thread) {
        List<QaMessageResponse> messages = thread == null
                ? List.of()
                : thread.getMessages().stream()
                .sorted(Comparator.comparing(message ->
                        message.getCreatedAt() == null ? Instant.EPOCH : message.getCreatedAt()))
                .map(QaMessageResponse::fromEntity)
                .toList();
        QaMessage latestMessage = thread == null
                ? null
                : thread.getMessages().stream()
                .max(Comparator.comparing(message ->
                        message.getCreatedAt() == null ? Instant.EPOCH : message.getCreatedAt()))
                .orElse(null);

        Profile teacher = course.getTeacher();
        return new ParentTeacherConversationResponse(
                thread != null ? thread.getId() : null,
                student.getId(),
                displayName(student, "Học sinh"),
                teacher.getId(),
                displayName(teacher, "Giáo viên"),
                teacher.getAvatarUrl(),
                course.getId(),
                course.getTitle(),
                course.getCategory() != null ? course.getCategory().getName() : null,
                resolveGradeLabel(List.of(course)),
                thread != null ? thread.getStatus().toDbValue() : null,
                thread != null ? thread.getCreatedAt() : null,
                thread != null ? thread.getLastActivityAt() : null,
                latestMessage != null ? latestMessage.getContent() : null,
                messages.size(),
                (int) messages.stream()
                        .filter(message -> "pending_review".equals(message.moderationStatus()))
                        .count(),
                messages);
    }


    private Profile requireLinkedStudent(AuthenticatedUser me, UUID studentId) {
        boolean linked = linkRepository.existsByIdParentIdAndIdStudentIdAndStatus(
                me.userId(), studentId, ParentStudentLinkStatus.ACTIVE.toDbValue());
        if (!linked) {
            throw new BusinessException(
                    "ACCESS_DENIED",
                    "Bạn không có quyền truy cập báo cáo của học sinh này do chưa liên kết tài khoản.",
                    HttpStatus.FORBIDDEN);
        }
        return profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
    }

    private Profile requireParentProfile(UUID parentId) {
        return profileRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", parentId));
    }

    private String resolveGradeLabel(List<Course> courses) {
        return courses.stream()
                .flatMap(course -> Arrays.stream(course.getGrades()).boxed())
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(", "));
    }

    private String displayName(Profile profile) {
        return displayName(profile, "Học sinh");
    }

    private String displayName(Profile profile, String fallback) {
        if (profile == null) return fallback;
        if (profile.getFullName() != null && !profile.getFullName().isBlank()) {
            return profile.getFullName();
        }
        return fallback;
    }

    private void throwForbidden() {
        throw new BusinessException("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", HttpStatus.FORBIDDEN);
    }
}
