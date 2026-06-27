package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.request.SendParentTeacherMessageRequest;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.dto.response.ParentPaymentHistoryResponse;
import com.beeacademy.backend.dto.response.ParentTeacherConversationResponse;
import com.beeacademy.backend.dto.response.QaMessageResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaMessage;
import com.beeacademy.backend.model.QaThread;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentService {

    private static final String PARENT_MESSAGE_BUCKET = "course-docs";
    private static final long MAX_PARENT_ATTACHMENT_BYTES = 20L * 1024 * 1024;
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
    private static final Duration LINK_INVITATION_TTL = Duration.ofDays(7);
    private static final int MAX_ACTIVE_OR_PENDING_CHILDREN = 5;

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final QaThreadRepository qaThreadRepository;
    private final OrderRepository orderRepository;
    private final ParentLinkInvitationEmailService parentLinkInvitationEmailService;
    private final SupabaseStorageClient storageClient;
    private final UserNotificationService notificationService;
    private final ParentTeacherMessageEmailService parentTeacherMessageEmailService;

    @Transactional(readOnly = true)
    public List<LinkedStudentResponse> getLinkedChildren(AuthenticatedUser me) {
        log.info("Parent {} requested linked children list", me.userId());

        List<ParentStudentLink> links = linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                me.userId(),
                ParentStudentLinkStatus.ACCEPTED.toDbValue());
        return links.stream()
                .map(this::toLinkedStudentResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ParentLinkInvitationResponse> getLinkInvitations(AuthenticatedUser me) {
        log.info("Parent {} requested pending link invitations", me.userId());

        return linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(),
                        ParentStudentLinkStatus.PENDING.toDbValue())
                .stream()
                .map(this::toParentLinkInvitationResponse)
                .toList();
    }

    @Transactional
    public ParentLinkInvitationResponse sendLinkInvitation(
            AuthenticatedUser me,
            SendParentLinkInvitationRequest request) {
        String normalizedEmail = request.studentEmail().trim().toLowerCase();
        log.info("Parent {} requested link invitation for {}", me.userId(), normalizedEmail);

        UUID studentId = profileRepository.findUserIdByEmail(normalizedEmail)
                .orElseThrow(() -> new BusinessException(
                        "STUDENT_EMAIL_NOT_FOUND",
                        "Không tìm thấy tài khoản học sinh với email này.",
                        HttpStatus.NOT_FOUND));

        Profile student = profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
        if (student.getRole() != UserRole.STUDENT) {
            throw new BusinessException(
                    "INVALID_STUDENT_ACCOUNT",
                    "Email này không thuộc tài khoản học sinh.",
                    HttpStatus.BAD_REQUEST);
        }

        ParentStudentLink existingLink = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElse(null);
        if (existingLink != null
                && (existingLink.getStatus() == ParentStudentLinkStatus.ACCEPTED
                || existingLink.getStatus() == ParentStudentLinkStatus.PENDING)) {
            throw new BusinessException(
                    "PARENT_LINK_ALREADY_EXISTS",
                    "Da co loi moi hoac lien ket dang hoat dong voi hoc sinh nay.",
                    HttpStatus.CONFLICT);
        }

        Profile parent = requireParentProfile(me.userId());
        long activeOrPendingChildren = linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(),
                        ParentStudentLinkStatus.ACCEPTED.toDbValue())
                .size()
                + linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                        me.userId(),
                        ParentStudentLinkStatus.PENDING.toDbValue())
                .size();
        if (activeOrPendingChildren >= MAX_ACTIVE_OR_PENDING_CHILDREN) {
            throw new BusinessException(
                    "PARENT_CHILD_LIMIT_EXCEEDED",
                    "A parent can have at most 5 active or pending child links.",
                    HttpStatus.CONFLICT);
        }

        String relationship = normalizeRelationship(request.relationship());
        String note = normalizeNote(request.note());
        ParentStudentLink link = existingLink == null
                ? ParentStudentLink.createPendingInvitation(parent, student, relationship, note)
                : existingLink;

        if (existingLink != null) {
            existingLink.markPending(relationship, note);
        }

        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        parentLinkInvitationEmailService.sendInvitation(
                normalizedEmail,
                displayName(student),
                displayName(parent));
        notificationService.notify(
                studentId,
                "parent_link_invitation",
                "Parent link invitation",
                displayName(parent) + " invited you to link parent account on Bee Academy.",
                "/student/notifications");

        return toParentLinkInvitationResponse(savedLink, normalizedEmail);
    }

    @Transactional
    public void cancelLinkInvitation(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested cancel pending link invitation for student {}", me.userId(), studentId);

        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElseThrow(() -> new BusinessException(
                        "PARENT_LINK_INVITATION_NOT_FOUND",
                        "Pending parent-student link invitation was not found.",
                        HttpStatus.NOT_FOUND));
        if (link.getStatus() != ParentStudentLinkStatus.PENDING) {
            throw new BusinessException(
                    "PARENT_LINK_INVITATION_NOT_PENDING",
                    "Only pending invitations can be cancelled.",
                    HttpStatus.CONFLICT);
        }

        link.reject();
        linkRepository.saveAndFlush(link);
    }

    @Transactional
    public LinkedStudentResponse unlinkStudent(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested unlink approval flow for student {}", me.userId(), studentId);

        ParentStudentLink link = requireActiveLink(me.userId(), studentId);
        if (link.hasPendingUnlinkRequest()) {
            if (link.isUnlinkRequestedBy(me.userId())) {
                return toLinkedStudentResponse(link);
            }

            link.revoke();
            ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
            log.info("Parent {} confirmed unlink requested by student {}", me.userId(), studentId);
            return toLinkedStudentResponse(savedLink);
        }

        link.requestUnlink(me.userId());
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        log.info("Parent {} sent unlink request to student {}", me.userId(), studentId);
        return toLinkedStudentResponse(savedLink);
    }

    @Transactional
    public LinkedStudentResponse confirmUnlinkStudent(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} confirmed unlink for student {}", me.userId(), studentId);

        ParentStudentLink link = requireActiveLink(me.userId(), studentId);
        if (!link.hasPendingUnlinkRequest()) {
            throw new BusinessException(
                    "UNLINK_REQUEST_NOT_FOUND",
                    "Chưa có yêu cầu hủy liên kết nào cần xác nhận.",
                    HttpStatus.CONFLICT);
        }
        if (link.isUnlinkRequestedBy(me.userId())) {
            throw new BusinessException(
                    "UNLINK_REQUEST_OWNED_BY_PARENT",
                    "Bạn đã gửi yêu cầu hủy. Cần học sinh đồng ý để hoàn tất.",
                    HttpStatus.CONFLICT);
        }

        link.revoke();
        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        log.info("Parent {} completed unlink for student {}", me.userId(), studentId);
        return toLinkedStudentResponse(savedLink);
    }

    @Transactional(readOnly = true)
    public ChildOverviewResponse getChildOverview(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested overview for student {}", me.userId(), studentId);

        Profile student = requireLinkedStudent(me, studentId);
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        List<UUID> courseIds = enrollments.stream()
                .map(Enrollment::getCourseId)
                .distinct()
                .toList();
        List<Course> courses = courseIds.isEmpty()
                ? List.of()
                : courseRepository.findByIdIn(courseIds);

        int totalCourses = enrollments.size();
        int completedCourses = (int) enrollments.stream()
                .filter(enrollment -> (enrollment.getProgressPct() != null ? enrollment.getProgressPct() : 0) >= 100)
                .count();
        int activeCourses = totalCourses - completedCourses;
        double avgProgress = totalCourses == 0
                ? 0.0
                : enrollments.stream()
                .mapToInt(enrollment -> enrollment.getProgressPct() != null ? enrollment.getProgressPct() : 0)
                .average()
                .orElse(0.0);

        Optional<QuizAttempt> latestQuizAttempt =
                quizAttemptRepository.findFirstByStudentIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(studentId);
        List<QuizAttempt> quizAttempts = courseIds.isEmpty()
                ? List.of()
                : quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);
        List<ExamAttempt> examAttempts = courseIds.isEmpty()
                ? List.of()
                : examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);

        double latestQuizScore = latestQuizAttempt
                .map(QuizAttempt::getScore)
                .map(BigDecimal::doubleValue)
                .map(this::round1)
                .orElse(0.0);
        double latestExamScore = examAttempts.stream()
                .findFirst()
                .map(this::toNormalizedExamScore)
                .orElse(0.0);

        return ChildOverviewResponse.builder()
                .studentName(displayName(student))
                .grade(resolveGradeLabel(courses))
                .avgProgress(round1(avgProgress))
                .activeCourses(activeCourses)
                .completedCourses(completedCourses)
                .latestQuizScore(latestQuizScore)
                .latestExamScore(latestExamScore)
                .weeklyActivityHours(buildWeeklyActivityHours(quizAttempts, examAttempts))
                .build();
    }

    @Transactional(readOnly = true)
    public ChildProgressReportResponse getChildProgressReport(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested detailed progress report for student {}", me.userId(), studentId);

        Profile student = requireLinkedStudent(me, studentId);
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);

        if (enrollments.isEmpty()) {
            return new ChildProgressReportResponse(
                    studentId,
                    displayName(student),
                    "",
                    Instant.now(),
                    List.of(),
                    List.of());
        }

        List<UUID> courseIds = enrollments.stream()
                .map(Enrollment::getCourseId)
                .distinct()
                .toList();
        Map<UUID, Enrollment> enrollmentByCourseId = enrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        enrollment -> enrollment,
                        (left, right) -> left,
                        LinkedHashMap::new));

        List<Course> courses = courseRepository.findByIdIn(courseIds);
        Map<UUID, Course> courseById = courses.stream()
                .collect(Collectors.toMap(Course::getId, course -> course));

        List<QuizConfig> quizConfigs = quizConfigRepository.findByCourseIds(courseIds);
        Map<UUID, List<QuizConfig>> quizConfigsByCourseId = quizConfigs.stream()
                .collect(Collectors.groupingBy(config -> config.getChapter().getCourse().getId()));

        List<QuizAttempt> quizAttempts = quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);
        List<ExamAttempt> examAttempts = examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);
        List<AssignmentSubmission> assignmentSubmissions =
                assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);

        Map<UUID, String> courseStatusById = enrollmentByCourseId.values().stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        this::toCourseStatus,
                        (left, right) -> left,
                        LinkedHashMap::new));

        List<ChildProgressReportResponse.CourseProgressItem> courseItems = enrollments.stream()
                .sorted(Comparator.comparing(
                        Enrollment::getEnrolledAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(enrollment -> toCourseProgressItem(
                        enrollment,
                        courseById.get(enrollment.getCourseId()),
                        quizConfigsByCourseId.getOrDefault(enrollment.getCourseId(), List.of()),
                        quizAttempts,
                        examAttempts,
                        assignmentSubmissions))
                .flatMap(Optional::stream)
                .toList();

        List<ChildProgressReportResponse.AssessmentRecord> assessments = buildAssessmentRecords(
                quizAttempts,
                examAttempts,
                assignmentSubmissions,
                courseById,
                courseStatusById);

        return new ChildProgressReportResponse(
                studentId,
                displayName(student),
                resolveGradeLabel(courses),
                Instant.now(),
                courseItems,
                assessments);
    }

    @Transactional(readOnly = true)
    public ParentPaymentHistoryResponse getChildPaymentHistory(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested payment history for student {}", me.userId(), studentId);

        Profile student = requireLinkedStudent(me, studentId);
        Profile parent = requireParentProfile(me.userId());
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);

        if (enrollments.isEmpty()) {
            return new ParentPaymentHistoryResponse(
                    studentId,
                    displayName(student),
                    "",
                    Instant.now(),
                    0L,
                    0,
                    0,
                    0.0,
                    List.of());
        }

        Map<UUID, Enrollment> enrollmentByCourseId = enrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        enrollment -> enrollment,
                        (left, right) -> left,
                        LinkedHashMap::new));
        List<UUID> courseIds = enrollmentByCourseId.keySet().stream().toList();
        Map<UUID, Course> courseById = courseRepository.findByIdIn(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));

        List<Order> orders = orderRepository.findParentChildHistoryWithItems(
                List.of(me.userId(), studentId),
                courseIds);
        List<ParentPaymentHistoryResponse.Transaction> transactions = orders.stream()
                .flatMap(order -> order.getItems().stream()
                        .filter(item -> enrollmentByCourseId.containsKey(item.getCourseId()))
                        .map(item -> toParentPaymentTransaction(
                                order,
                                item,
                                parent,
                                student,
                                courseById.get(item.getCourseId()),
                                enrollmentByCourseId.get(item.getCourseId()))))
                .sorted(Comparator.comparing(
                        ParentPaymentHistoryResponse.Transaction::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        long totalPaidAmount = transactions.stream()
                .filter(transaction -> transaction.status() == OrderStatus.PAID)
                .mapToLong(transaction -> transaction.amountVnd() != null ? transaction.amountVnd() : 0)
                .sum();
        int pendingCount = (int) transactions.stream()
                .filter(transaction -> transaction.status() == OrderStatus.PENDING)
                .count();
        double averageProgress = transactions.isEmpty()
                ? 0.0
                : transactions.stream()
                .mapToInt(transaction -> transaction.currentProgressPct() != null ? transaction.currentProgressPct() : 0)
                .average()
                .orElse(0.0);

        return new ParentPaymentHistoryResponse(
                studentId,
                displayName(student),
                resolveGradeLabel(courseById.values().stream().toList()),
                Instant.now(),
                totalPaidAmount,
                transactions.size(),
                pendingCount,
                round1(averageProgress),
                transactions);
    }

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
                    request.attachmentSizeBytes());
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
                messages);
    }

    private ParentPaymentHistoryResponse.Transaction toParentPaymentTransaction(
            Order order,
            OrderItem item,
            Profile parent,
            Profile student,
            Course course,
            Enrollment enrollment) {
        String payerRole = order.getUserId().equals(parent.getId()) ? "parent" : "student";
        Profile payer = "parent".equals(payerRole) ? parent : student;
        OrderStatus status = order.isExpired() ? OrderStatus.EXPIRED : order.getStatus();
        Integer progressPct = enrollment != null && enrollment.getProgressPct() != null
                ? enrollment.getProgressPct()
                : 0;
        String courseSuffix = item.getCourseId().toString().substring(0, 8).toUpperCase();

        return new ParentPaymentHistoryResponse.Transaction(
                order.getId(),
                order.getOrderCode(),
                order.getPaymentRef(),
                order.getUserId(),
                displayName(payer, "parent".equals(payerRole) ? "Phụ huynh" : "Học sinh"),
                payerRole,
                item.getCourseId(),
                course != null ? course.getTitle() : "Khóa học",
                course != null && course.getTeacher() != null ? displayName(course.getTeacher(), "Giáo viên") : null,
                course != null && course.getCategory() != null ? course.getCategory().getName() : null,
                course != null ? course.getThumbnailUrl() : null,
                course != null ? Arrays.stream(course.getGrades()).boxed().sorted().toList() : List.of(),
                item.getPriceAtPurchase(),
                status,
                order.getCreatedAt(),
                order.getPaidAt(),
                progressPct,
                order.getPaymentRef() + "-" + courseSuffix);
    }

    private Profile requireLinkedStudent(AuthenticatedUser me, UUID studentId) {
        boolean isLinked = linkRepository.existsByIdParentIdAndIdStudentIdAndStatus(
                me.userId(),
                studentId,
                ParentStudentLinkStatus.ACCEPTED.toDbValue());
        if (!isLinked) {
            throw new BusinessException(
                    "ACCESS_DENIED",
                    "Bạn không có quyền truy cập báo cáo của học sinh này do chưa liên kết tài khoản.",
                    HttpStatus.FORBIDDEN);
        }

        return profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
    }

    private ParentStudentLink requireActiveLink(UUID parentId, UUID studentId) {
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)
                .orElseThrow(() -> new BusinessException(
                        "LINK_NOT_FOUND",
                        "Không tìm thấy thông tin liên kết giữa tài khoản của bạn và học sinh này.",
                        HttpStatus.NOT_FOUND));

        if (link.getStatus() != ParentStudentLinkStatus.ACCEPTED) {
            throw new BusinessException(
                    "LINK_NOT_ACTIVE",
                    "Liên kết này không còn ở trạng thái hoạt động.",
                    HttpStatus.CONFLICT);
        }

        return link;
    }

    private Profile requireParentProfile(UUID parentId) {
        return profileRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", parentId));
    }

    private LinkedStudentResponse toLinkedStudentResponse(ParentStudentLink link) {
        Profile student = link.getStudent();
        return LinkedStudentResponse.builder()
                .id(student.getId())
                .name(displayName(student))
                .avatarUrl(student.getAvatarUrl())
                .code("")
                .grade(resolveGradeLabel(student.getId()))
                .linkStatus(link.getStatus().toApiValue())
                .unlinkRequestedById(link.getUnlinkRequestedBy())
                .unlinkRequestedByRole(resolveUnlinkRequestedByRole(link))
                .unlinkRequestedAt(link.getUnlinkRequestedAt())
                .build();
    }

    private ParentLinkInvitationResponse toParentLinkInvitationResponse(ParentStudentLink link) {
        String studentEmail = profileRepository.findEmailByUserId(link.getStudent().getId()).orElse("");
        return toParentLinkInvitationResponse(link, studentEmail);
    }

    private ParentLinkInvitationResponse toParentLinkInvitationResponse(ParentStudentLink link, String studentEmail) {
        Profile student = link.getStudent();
        return new ParentLinkInvitationResponse(
                student.getId(),
                displayName(student),
                studentEmail,
                student.getAvatarUrl(),
                resolveGradeLabel(student.getId()),
                link.getRelationship(),
                link.getNote(),
                link.getStatus().toApiValue(),
                link.getInvitedAt(),
                expiresAt(link),
                isExpired(link),
                link.getRespondedAt(),
                link.getUnlinkRequestedBy(),
                resolveUnlinkRequestedByRole(link),
                link.getUnlinkRequestedAt());
    }

    private Instant expiresAt(ParentStudentLink link) {
        return link.getInvitedAt() == null ? null : link.getInvitedAt().plus(LINK_INVITATION_TTL);
    }

    private boolean isExpired(ParentStudentLink link) {
        Instant expiresAt = expiresAt(link);
        return expiresAt != null && expiresAt.isBefore(Instant.now());
    }

    private String normalizeRelationship(String relationship) {
        if (relationship == null || relationship.isBlank()) {
            return "guardian";
        }
        String normalized = relationship.trim().toLowerCase();
        if (!List.of("father", "mother", "guardian").contains(normalized)) {
            throw new BusinessException(
                    "INVALID_RELATIONSHIP",
                    "Relationship must be father, mother, or guardian.",
                    HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        String normalized = note.trim();
        return normalized.length() <= 500 ? normalized : normalized.substring(0, 500);
    }

    private String resolveUnlinkRequestedByRole(ParentStudentLink link) {
        UUID requestedBy = link.getUnlinkRequestedBy();
        if (requestedBy == null) {
            return null;
        }
        if (requestedBy.equals(link.getParent().getId())) {
            return "parent";
        }
        if (requestedBy.equals(link.getStudent().getId())) {
            return "student";
        }
        return null;
    }

    private String resolveGradeLabel(UUID studentId) {
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        if (enrollments.isEmpty()) {
            return "";
        }

        List<UUID> courseIds = enrollments.stream()
                .map(Enrollment::getCourseId)
                .distinct()
                .toList();
        if (courseIds.isEmpty()) {
            return "";
        }

        return resolveGradeLabel(courseRepository.findByIdIn(courseIds));
    }

    private Optional<ChildProgressReportResponse.CourseProgressItem> toCourseProgressItem(
            Enrollment enrollment,
            Course course,
            List<QuizConfig> quizConfigs,
            List<QuizAttempt> quizAttempts,
            List<ExamAttempt> examAttempts,
            List<AssignmentSubmission> assignmentSubmissions) {
        if (course == null) {
            return Optional.empty();
        }

        UUID courseId = course.getId();
        List<QuizAttempt> courseQuizAttempts = quizAttempts.stream()
                .filter(attempt -> attempt.getQuizConfig().getChapter().getCourse().getId().equals(courseId))
                .toList();
        List<ExamAttempt> courseExamAttempts = examAttempts.stream()
                .filter(attempt -> attempt.getExamConfig().getCourse().getId().equals(courseId))
                .toList();
        List<AssignmentSubmission> courseAssignmentSubmissions = assignmentSubmissions.stream()
                .filter(submission -> courseId.equals(resolveAssignmentCourseId(submission)))
                .toList();

        Map<UUID, Double> latestQuizScoresByConfig = new LinkedHashMap<>();
        for (QuizAttempt attempt : courseQuizAttempts) {
            UUID quizConfigId = attempt.getQuizConfig().getId();
            if (!latestQuizScoresByConfig.containsKey(quizConfigId) && attempt.getScore() != null) {
                latestQuizScoresByConfig.put(quizConfigId, round1(attempt.getScore().doubleValue()));
            }
        }

        Double averageQuizScore = latestQuizScoresByConfig.isEmpty()
                ? null
                : round1(latestQuizScoresByConfig.values().stream()
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0));

        Double latestQuizScore = courseQuizAttempts.stream()
                .findFirst()
                .map(QuizAttempt::getScore)
                .map(BigDecimal::doubleValue)
                .map(this::round1)
                .orElse(null);

        Double latestExamScore = courseExamAttempts.stream()
                .findFirst()
                .map(this::toNormalizedExamScore)
                .orElse(null);

        Double latestAssignmentScore = courseAssignmentSubmissions.stream()
                .findFirst()
                .map(this::toNormalizedAssignmentScore)
                .orElse(null);

        return Optional.of(new ChildProgressReportResponse.CourseProgressItem(
                courseId,
                course.getTitle(),
                course.getTeacher() != null ? displayName(course.getTeacher()) : null,
                toCourseStatus(enrollment),
                enrollment.getProgressPct() != null ? enrollment.getProgressPct() : 0,
                enrollment.getEnrolledAt(),
                toGradeList(course),
                latestQuizScoresByConfig.size(),
                quizConfigs.size(),
                averageQuizScore,
                latestQuizScore,
                latestExamScore,
                latestAssignmentScore));
    }

    private List<ChildProgressReportResponse.AssessmentRecord> buildAssessmentRecords(
            List<QuizAttempt> quizAttempts,
            List<ExamAttempt> examAttempts,
            List<AssignmentSubmission> assignmentSubmissions,
            Map<UUID, Course> courseById,
            Map<UUID, String> courseStatusById) {
        List<ChildProgressReportResponse.AssessmentRecord> records = quizAttempts.stream()
                .map(attempt -> toQuizAssessmentRecord(attempt, courseStatusById))
                .collect(Collectors.toList());

        records.addAll(examAttempts.stream()
                .map(attempt -> toExamAssessmentRecord(attempt, courseStatusById))
                .toList());

        records.addAll(assignmentSubmissions.stream()
                .map(submission -> toAssignmentAssessmentRecord(submission, courseById, courseStatusById))
                .toList());

        return records.stream()
                .sorted(Comparator.comparing(
                        ChildProgressReportResponse.AssessmentRecord::submittedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private ChildProgressReportResponse.AssessmentRecord toQuizAssessmentRecord(
            QuizAttempt attempt,
            Map<UUID, String> courseStatusById) {
        Course course = attempt.getQuizConfig().getChapter().getCourse();
        String chapterTitle = attempt.getQuizConfig().getChapter().getTitle();
        Double score = attempt.getScore() == null ? null : round1(attempt.getScore().doubleValue());
        return new ChildProgressReportResponse.AssessmentRecord(
                "quiz:" + attempt.getId(),
                course.getId(),
                course.getTitle(),
                courseStatusById.getOrDefault(course.getId(), "active"),
                "Quiz - " + chapterTitle,
                "quiz",
                chapterTitle,
                score,
                10.0,
                score,
                null,
                attempt.getSubmittedAt());
    }

    private ChildProgressReportResponse.AssessmentRecord toExamAssessmentRecord(
            ExamAttempt attempt,
            Map<UUID, String> courseStatusById) {
        Course course = attempt.getExamConfig().getCourse();
        Double rawScore = attempt.getEffectiveScorePercent() == null
                ? null
                : round1(attempt.getEffectiveScorePercent().doubleValue());
        return new ChildProgressReportResponse.AssessmentRecord(
                "exam:" + attempt.getId(),
                course.getId(),
                course.getTitle(),
                courseStatusById.getOrDefault(course.getId(), "active"),
                attempt.getExamConfig().getName(),
                "exam",
                null,
                rawScore,
                100.0,
                rawScore == null ? null : round1(rawScore / 10.0),
                attempt.getTeacherFeedback(),
                attempt.getSubmittedAt());
    }

    private ChildProgressReportResponse.AssessmentRecord toAssignmentAssessmentRecord(
            AssignmentSubmission submission,
            Map<UUID, Course> courseById,
            Map<UUID, String> courseStatusById) {
        Assignment assignment = submission.getAssignment();
        UUID courseId = resolveAssignmentCourseId(submission);
        Course course = courseById.get(courseId);
        Double rawScore = submission.getScore() == null ? null : submission.getScore().doubleValue();
        Double maxScore = assignment.getMaxScore() == null ? null : assignment.getMaxScore().doubleValue();
        return new ChildProgressReportResponse.AssessmentRecord(
                "assignment:" + submission.getId(),
                courseId,
                course != null ? course.getTitle() : assignment.getTitle(),
                courseStatusById.getOrDefault(courseId, "active"),
                assignment.getTitle(),
                "assignment",
                resolveAssignmentChapterTitle(submission),
                rawScore,
                maxScore,
                toNormalizedAssignmentScore(submission),
                submission.getFeedback(),
                submission.getSubmittedAt());
    }

    private List<Double> buildWeeklyActivityHours(List<QuizAttempt> quizAttempts, List<ExamAttempt> examAttempts) {
        ZoneId zoneId = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zoneId);
        LocalDate weekStart = today.minusDays(6);
        Map<DayOfWeek, Double> totals = new HashMap<>();

        for (QuizAttempt attempt : quizAttempts) {
            addDurationToWeekday(
                    totals,
                    attempt.getStartedAt(),
                    attempt.getSubmittedAt(),
                    attempt.getQuizConfig().getTimeLimitMinutes() != null
                            ? attempt.getQuizConfig().getTimeLimitMinutes()
                            : 45,
                    zoneId,
                    weekStart);
        }

        for (ExamAttempt attempt : examAttempts) {
            addDurationToWeekday(
                    totals,
                    attempt.getStartedAt(),
                    attempt.getSubmittedAt(),
                    attempt.getExamConfig().getDurationMinutes() != null
                            ? attempt.getExamConfig().getDurationMinutes()
                            : 120,
                    zoneId,
                    weekStart);
        }

        return List.of(
                round1(totals.getOrDefault(DayOfWeek.MONDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.TUESDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.WEDNESDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.THURSDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.FRIDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.SATURDAY, 0.0)),
                round1(totals.getOrDefault(DayOfWeek.SUNDAY, 0.0)));
    }

    private void addDurationToWeekday(
            Map<DayOfWeek, Double> totals,
            Instant startedAt,
            Instant submittedAt,
            int maxMinutes,
            ZoneId zoneId,
            LocalDate weekStart) {
        if (startedAt == null || submittedAt == null || submittedAt.isBefore(startedAt)) {
            return;
        }

        LocalDate activityDate = submittedAt.atZone(zoneId).toLocalDate();
        if (activityDate.isBefore(weekStart)) {
            return;
        }

        long actualMinutes = Duration.between(startedAt, submittedAt).toMinutes();
        long boundedMinutes = Math.max(0, Math.min(actualMinutes, maxMinutes));
        double hours = boundedMinutes / 60.0;
        totals.merge(activityDate.getDayOfWeek(), hours, Double::sum);
    }

    private UUID resolveAssignmentCourseId(AssignmentSubmission submission) {
        Assignment assignment = submission.getAssignment();
        if (assignment.getChapter() != null) {
            return assignment.getChapter().getCourse().getId();
        }
        if (assignment.getLesson() != null && assignment.getLesson().getChapter() != null) {
            return assignment.getLesson().getChapter().getCourse().getId();
        }
        throw new IllegalStateException("Assignment submission is not attached to a course");
    }

    private String resolveAssignmentChapterTitle(AssignmentSubmission submission) {
        Assignment assignment = submission.getAssignment();
        if (assignment.getChapter() != null) {
            return assignment.getChapter().getTitle();
        }
        if (assignment.getLesson() != null && assignment.getLesson().getChapter() != null) {
            return assignment.getLesson().getChapter().getTitle();
        }
        return null;
    }

    private Double toNormalizedExamScore(ExamAttempt attempt) {
        if (attempt.getEffectiveScorePercent() == null) {
            return null;
        }
        return round1(attempt.getEffectiveScorePercent().doubleValue() / 10.0);
    }

    private Double toNormalizedAssignmentScore(AssignmentSubmission submission) {
        if (submission.getScore() == null
                || submission.getAssignment() == null
                || submission.getAssignment().getMaxScore() == null
                || submission.getAssignment().getMaxScore() <= 0) {
            return null;
        }

        return round1((submission.getScore().doubleValue() / submission.getAssignment().getMaxScore()) * 10.0);
    }

    private List<Integer> toGradeList(Course course) {
        return java.util.Arrays.stream(course.getGrades())
                .boxed()
                .sorted()
                .toList();
    }

    private String resolveGradeLabel(List<Course> courses) {
        List<Integer> grades = courses.stream()
                .flatMap(course -> toGradeList(course).stream())
                .distinct()
                .sorted()
                .toList();
        if (grades.isEmpty()) {
            return "";
        }
        if (grades.size() == 1) {
            return "Lớp " + grades.get(0);
        }
        return "Lớp " + grades.get(0) + "-" + grades.get(grades.size() - 1);
    }

    private String toCourseStatus(Enrollment enrollment) {
        int progress = enrollment.getProgressPct() != null ? enrollment.getProgressPct() : 0;
        return progress >= 100 ? "completed" : "active";
    }

    private String displayName(Profile profile) {
        return displayName(profile, "Học sinh");
    }

    private String displayName(Profile profile, String fallback) {
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return fallback;
        }
        return profile.getFullName();
    }

    private void throwForbidden() {
        throw new BusinessException(
                "FORBIDDEN",
                "Bạn không có quyền thực hiện thao tác này.",
                HttpStatus.FORBIDDEN);
    }

    private double round1(double value) {
        return BigDecimal.valueOf(value)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
