package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateAssignmentRequest;
import com.beeacademy.backend.dto.request.GradeAssignmentSubmissionRequest;
import com.beeacademy.backend.dto.request.SubmitAssignmentRequest;
import com.beeacademy.backend.dto.request.UpdateAssignmentPolicyRequest;
import com.beeacademy.backend.dto.response.AssignmentSubmissionResponse;
import com.beeacademy.backend.dto.response.StudentAssignmentResponse;
import com.beeacademy.backend.dto.response.TeacherAssignmentResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.exception.UnauthorizedException;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.AssignmentRepository;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.GradeAuditLogRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private static final int DEFAULT_MAX_ATTEMPTS = 3;
    private static final long MAX_SUBMISSION_FILE_BYTES = 25L * 1024 * 1024;
    private static final int DEFAULT_ASSIGNMENT_PASS_PERCENT = 50;
    private static final java.util.Set<String> ALLOWED_SUBMISSION_TYPES = java.util.Set.of(
            "pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "webp",
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "image/jpeg", "image/png", "image/webp");

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final ChapterRepository chapterRepository;
    private final LessonRepository lessonRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final GradeAuditLogRepository gradeAuditLogRepository;
    private final UserNotificationService userNotificationService;
    private final TeacherAccessService teacherAccessService;
    private final CourseProgressService courseProgressService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AssignmentSubmissionResponse> listTeacherSubmissions(AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        return submissionRepository.findAllForTeacher(me.userId()).stream()
                .map(this::toResponse)
                .toList();
    }

    // ========================================================================
    // Teacher: quản lý bài tập (UC16)
    // ========================================================================

    @Transactional
    public TeacherAssignmentResponse createAssignment(
            AuthenticatedUser me, CreateAssignmentRequest request) {
        teacherAccessService.requireApprovedTeacher(me);
        if (request.chapterId() == null && request.lessonId() == null) {
            throw new BusinessException("ASSIGNMENT_TARGET_REQUIRED",
                    "Bài tập phải gắn với một chương hoặc một bài giảng.");
        }

        Chapter chapter = null;
        Lesson lesson = null;
        Course course;
        if (request.lessonId() != null) {
            lesson = lessonRepository.findById(request.lessonId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Lesson", request.lessonId()));
            course = lesson.getChapter().getCourse();
        } else {
            chapter = chapterRepository.findWithCourseById(request.chapterId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Chapter", request.chapterId()));
            course = chapter.getCourse();
        }
        verifyCourseOwner(course, me.userId());

        Assignment assignment = Assignment.create(
                chapter, lesson, request.title(), request.description(),
                request.maxScore(), request.dueAt(),
                request.maxAttempts() != null ? request.maxAttempts() : DEFAULT_MAX_ATTEMPTS,
                Boolean.TRUE.equals(request.allowLateSubmission()),
                request.latePenaltyPercent() != null ? request.latePenaltyPercent() : 0,
                request.acceptingSubmissions() == null || request.acceptingSubmissions());
        return toTeacherResponse(assignmentRepository.save(assignment));
    }

    @Transactional
    public TeacherAssignmentResponse updateSubmissionPolicy(
            UUID assignmentId,
            AuthenticatedUser me,
            UpdateAssignmentPolicyRequest request) {
        teacherAccessService.requireApprovedTeacher(me);
        Assignment assignment = assignmentRepository.findWithCourseById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment", assignmentId));
        verifyCourseOwner(assignment.getCourse(), me.userId());
        assignment.updateSubmissionPolicy(
                request.dueAt(),
                request.maxAttempts(),
                request.allowLateSubmission(),
                request.latePenaltyPercent(),
                request.acceptingSubmissions());
        return toTeacherResponse(assignmentRepository.save(assignment));
    }

    @Transactional(readOnly = true)
    public List<TeacherAssignmentResponse> listTeacherAssignments(AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        return assignmentRepository.findAllByTeacherId(me.userId()).stream()
                .map(this::toTeacherResponse)
                .toList();
    }

    @Transactional
    public void deleteAssignment(UUID assignmentId, AuthenticatedUser me) {
        teacherAccessService.requireApprovedTeacher(me);
        Assignment assignment = assignmentRepository.findWithCourseById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment", assignmentId));
        verifyCourseOwner(assignment.getCourse(), me.userId());
        assignmentRepository.delete(assignment);
    }

    // ========================================================================
    // Student: xem + nộp bài tập (UC16)
    // ========================================================================

    @Transactional(readOnly = true)
    public List<StudentAssignmentResponse> listStudentAssignments(
            UUID courseId, AuthenticatedUser me) {
        requireEnrollment(me.userId(), courseId);

        List<Assignment> assignments = assignmentRepository.findAllByCourseId(courseId);
        if (assignments.isEmpty()) return List.of();

        Map<UUID, AssignmentSubmission> mySubmissions = submissionRepository
                .findByAssignmentIdInAndStudentId(
                        assignments.stream().map(Assignment::getId).toList(),
                        me.userId())
                .stream()
                .collect(Collectors.toMap(
                        submission -> submission.getAssignment().getId(),
                        Function.identity()));

        return assignments.stream()
                .map(assignment -> toStudentResponse(
                        assignment, mySubmissions.get(assignment.getId())))
                .toList();
    }

    @Transactional
    public StudentAssignmentResponse submitAssignment(
            UUID assignmentId, AuthenticatedUser me, SubmitAssignmentRequest request) {
        boolean hasContent = request.content() != null && !request.content().isBlank();
        boolean hasFiles = request.files() != null && !request.files().isEmpty();
        if (!hasContent && !hasFiles) {
            throw new BusinessException("EMPTY_SUBMISSION",
                    "Bài nộp phải có nội dung hoặc file đính kèm.");
        }

        Assignment assignment = assignmentRepository.findWithCourseById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment", assignmentId));
        Course course = assignment.getCourse();
        if (course == null) {
            throw new BusinessException("ASSIGNMENT_COURSE_MISSING",
                    "Bài tập chưa được liên kết với khóa học.");
        }
        requireEnrollment(me.userId(), course.getId());

        Instant submittedAt = Instant.now();
        AssignmentSubmission existing = submissionRepository
                .findByAssignmentIdAndStudentId(assignmentId, me.userId())
                .orElse(null);
        validateCanSubmit(assignment, existing, submittedAt);
        boolean late = isPastDeadline(assignment, submittedAt);
        int latePenaltyPercent = late ? assignment.effectiveLatePenaltyPercent() : 0;
        String filesJson = writeFiles(request.files());
        AssignmentSubmission submission;
        if (existing != null) {
            existing.resubmit(request.content(), filesJson, late, latePenaltyPercent);
            submission = existing;
        } else {
            Profile student = profileRepository.findById(me.userId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Profile", me.userId()));
            submission = AssignmentSubmission.submit(
                    assignment, student, request.content(), filesJson,
                    late, latePenaltyPercent);
        }
        AssignmentSubmission saved = submissionRepository.save(submission);
        completeAssignmentRuleIfSatisfied(saved, "ASSIGNMENT_SUBMITTED");
        if (course.getTeacher() != null) {
            userNotificationService.notify(
                    course.getTeacher().getId(),
                    "assignment_submitted",
                    "Có bài tập mới được nộp",
                    (saved.getStudent().getFullName() == null ? "Học sinh" : saved.getStudent().getFullName())
                            + " đã nộp bài \"" + assignment.getTitle() + "\".",
                    "/teacher/grades");
        }
        return toStudentResponse(assignment, saved);
    }

    @Transactional(readOnly = true)
    public void verifyCanSubmit(UUID assignmentId, UUID studentId) {
        Assignment assignment = assignmentRepository.findWithCourseById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment", assignmentId));
        Course course = assignment.getCourse();
        if (course == null) {
            throw new BusinessException("ASSIGNMENT_COURSE_MISSING",
                    "Bài tập chưa được liên kết với khóa học.");
        }
        requireEnrollment(studentId, course.getId());
        AssignmentSubmission existing = submissionRepository
                .findByAssignmentIdAndStudentId(assignmentId, studentId)
                .orElse(null);
        validateCanSubmit(assignment, existing, Instant.now());
    }

    private void validateCanSubmit(
            Assignment assignment,
            AssignmentSubmission existing,
            Instant submittedAt) {
        if (!assignment.isAcceptingSubmissions()) {
            throw new BusinessException(
                    "ASSIGNMENT_CLOSED",
                    "Bài tập đã đóng và không nhận thêm bài nộp.",
                    HttpStatus.CONFLICT);
        }
        if (existing != null && "graded".equals(existing.getStatus())) {
            throw new BusinessException(
                    "ALREADY_GRADED",
                    "Bài đã được chấm điểm, không thể nộp lại.",
                    HttpStatus.CONFLICT);
        }
        if (existing != null
                && existing.effectiveAttemptNumber() >= assignment.effectiveMaxAttempts()) {
            throw new BusinessException(
                    "ASSIGNMENT_ATTEMPT_LIMIT_REACHED",
                    "Bạn đã sử dụng hết " + assignment.effectiveMaxAttempts()
                            + " lần nộp của bài tập này.",
                    HttpStatus.CONFLICT);
        }
        if (isPastDeadline(assignment, submittedAt)
                && !assignment.permitsLateSubmission()) {
            throw new BusinessException(
                    "ASSIGNMENT_OVERDUE",
                    "Bài tập đã quá hạn và giáo viên không cho phép nộp muộn.",
                    HttpStatus.CONFLICT);
        }
    }

    private boolean isPastDeadline(Assignment assignment, Instant at) {
        return assignment.getDueAt() != null && at.isAfter(assignment.getDueAt());
    }

    private void requireEnrollment(UUID studentId, UUID courseId) {
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new UnauthorizedException("NOT_ENROLLED",
                    "Bạn chưa đăng ký khóa học này.", HttpStatus.FORBIDDEN);
        }
    }

    private void verifyCourseOwner(Course course, UUID teacherId) {
        if (course == null || course.getTeacher() == null
                || !course.getTeacher().getId().equals(teacherId)) {
            throw new UnauthorizedException("FORBIDDEN",
                    "Không có quyền thao tác trên khóa học này.", HttpStatus.FORBIDDEN);
        }
    }

    private String writeFiles(List<SubmitAssignmentRequest.SubmissionFile> files) {
        if (files == null || files.isEmpty()) return "[]";
        List<SubmitAssignmentRequest.SubmissionFile> valid = files.stream()
                .filter(file -> file.url() != null && !file.url().isBlank())
                .toList();
        if (valid.size() != files.size()) {
            throw new BusinessException("INVALID_FILES", "Mỗi file đính kèm phải có đường dẫn hợp lệ.");
        }
        for (SubmitAssignmentRequest.SubmissionFile file : valid) {
            if (file.sizeBytes() == null || file.sizeBytes() < 0
                    || file.sizeBytes() > MAX_SUBMISSION_FILE_BYTES) {
                throw new BusinessException("FILE_TOO_LARGE", "Mỗi file bài tập tối đa 25MB.");
            }
            String type = file.type() == null ? "" : file.type().trim().toLowerCase(java.util.Locale.ROOT);
            String name = file.name() == null ? "" : file.name().trim().toLowerCase(java.util.Locale.ROOT);
            String extension = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1) : type;
            if (!ALLOWED_SUBMISSION_TYPES.contains(type)
                    && !ALLOWED_SUBMISSION_TYPES.contains(extension)) {
                throw new BusinessException(
                        "UNSUPPORTED_FILE_TYPE",
                        "Chỉ hỗ trợ PDF, DOC/DOCX, PPT/PPTX và ảnh JPEG/PNG/WEBP.");
            }
        }
        try {
            return objectMapper.writeValueAsString(valid);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("INVALID_FILES",
                    "Danh sách file đính kèm không hợp lệ.");
        }
    }

    private TeacherAssignmentResponse toTeacherResponse(Assignment assignment) {
        Course course = assignment.getCourse();
        Chapter chapter = assignment.getChapter() != null
                ? assignment.getChapter()
                : assignment.getLesson() != null ? assignment.getLesson().getChapter() : null;
        return new TeacherAssignmentResponse(
                assignment.getId(),
                assignment.getTitle(),
                assignment.getDescription(),
                assignment.getMaxScore(),
                assignment.getDueAt(),
                assignment.effectiveMaxAttempts(),
                assignment.permitsLateSubmission(),
                assignment.effectiveLatePenaltyPercent(),
                assignment.isAcceptingSubmissions(),
                course != null ? course.getId() : null,
                course != null ? course.getTitle() : null,
                chapter != null ? chapter.getId() : null,
                chapter != null ? chapter.getTitle() : null,
                assignment.getLesson() != null ? assignment.getLesson().getId() : null,
                assignment.getLesson() != null ? assignment.getLesson().getTitle() : null,
                assignment.getCreatedAt());
    }

    private StudentAssignmentResponse toStudentResponse(
            Assignment assignment, AssignmentSubmission submission) {
        Chapter chapter = assignment.getChapter() != null
                ? assignment.getChapter()
                : assignment.getLesson() != null ? assignment.getLesson().getChapter() : null;
        StudentAssignmentResponse.MySubmission mySubmission = null;
        if (submission != null) {
            String status = switch (submission.getStatus()) {
                case "graded" -> "graded";
                case "returned" -> "resubmit";
                default -> "pending";
            };
            mySubmission = new StudentAssignmentResponse.MySubmission(
                    submission.getId(),
                    status,
                    submission.getContent(),
                    readFiles(submission.getFileUrlsJson()),
                    submission.getScore(),
                    submission.getFeedback(),
                    submission.getSubmittedAt(),
                    submission.getExpectedGradedBy(),
                    submission.getGradedAt(),
                    submission.isLate(),
                    submission.effectiveAttemptNumber(),
                    submission.effectiveLatePenaltyPercent(),
                    submission.getRawScore());
        }
        SubmissionAvailability availability = submissionAvailability(
                assignment, submission, Instant.now());
        return new StudentAssignmentResponse(
                assignment.getId(),
                assignment.getTitle(),
                assignment.getDescription(),
                assignment.getMaxScore(),
                assignment.getDueAt(),
                assignment.effectiveMaxAttempts(),
                assignment.permitsLateSubmission(),
                assignment.effectiveLatePenaltyPercent(),
                assignment.isAcceptingSubmissions(),
                availability.status(),
                availability.canSubmit(),
                availability.remainingAttempts(),
                chapter != null ? chapter.getId() : null,
                chapter != null ? chapter.getTitle() : null,
                assignment.getLesson() != null ? assignment.getLesson().getId() : null,
                assignment.getLesson() != null ? assignment.getLesson().getTitle() : null,
                mySubmission);
    }

    private SubmissionAvailability submissionAvailability(
            Assignment assignment,
            AssignmentSubmission submission,
            Instant at) {
        int attemptsUsed = submission != null ? submission.effectiveAttemptNumber() : 0;
        int remainingAttempts = Math.max(
                0, assignment.effectiveMaxAttempts() - attemptsUsed);
        if (!assignment.isAcceptingSubmissions()) {
            return new SubmissionAvailability("closed", false, remainingAttempts);
        }
        if (submission != null && "graded".equals(submission.getStatus())) {
            return new SubmissionAvailability("graded", false, remainingAttempts);
        }
        if (remainingAttempts == 0) {
            return new SubmissionAvailability("attempts_exhausted", false, 0);
        }
        if (isPastDeadline(assignment, at)) {
            return assignment.permitsLateSubmission()
                    ? new SubmissionAvailability("late_allowed", true, remainingAttempts)
                    : new SubmissionAvailability("overdue", false, remainingAttempts);
        }
        return new SubmissionAvailability("open", true, remainingAttempts);
    }

    @Transactional
    public AssignmentSubmissionResponse gradeSubmission(
            UUID submissionId,
            AuthenticatedUser me,
            GradeAssignmentSubmissionRequest request) {
        teacherAccessService.requireApprovedTeacher(me);
        AssignmentSubmission submission = submissionRepository
                .findOwned(submissionId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "AssignmentSubmission", submissionId));
        int maxScore = submission.getAssignment().getMaxScore();
        if (request.score() > maxScore || request.score() % 1 != 0) {
            throw new BusinessException("INVALID_SCORE",
                    "Điểm phải là số nguyên từ 0 đến " + maxScore + ".");
        }
        Profile teacher = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        Double oldScore = submission.getScore() != null ? submission.getScore().doubleValue() : null;
        validateGradeRevision(submission.getGradedAt(), request.revisionReason());
        int rawScore = request.score().intValue();
        int appliedLatePenaltyPercent = submission.isLate()
                ? submission.effectiveLatePenaltyPercent()
                : 0;
        int finalScore = (int) Math.floor(
                rawScore * (100 - appliedLatePenaltyPercent) / 100.0);
        submission.grade(
                rawScore,
                finalScore,
                appliedLatePenaltyPercent,
                request.feedback(),
                teacher);
        AssignmentSubmission saved = submissionRepository.save(submission);
        gradeAuditLogRepository.save(com.beeacademy.backend.model.GradeAuditLog.create(
                "assignment_submission",
                saved.getId(),
                saved.getStudent().getId(),
                me.userId(),
                oldScore,
                saved.getScore() != null ? saved.getScore().doubleValue() : null,
                request.revisionReason()));
        userNotificationService.notify(
                saved.getStudent().getId(),
                "assignment_graded",
                "Bài tập đã được chấm điểm",
                "Bài tập \"" + saved.getAssignment().getTitle() + "\" đã có điểm.",
                "/student/courses");
        if (saved.getScore() != null
                && saved.getAssignment().getMaxScore() != null
                && saved.getAssignment().getMaxScore() > 0
                && saved.getScore() * 100
                >= saved.getAssignment().getMaxScore() * DEFAULT_ASSIGNMENT_PASS_PERCENT) {
            completeAssignmentRuleIfSatisfied(saved, "ASSIGNMENT_PASSED");
        }
        return toResponse(saved);
    }

    private void validateGradeRevision(Instant gradedAt, String reason) {
        if (gradedAt == null) {
            return;
        }
        if (gradedAt.isBefore(Instant.now().minus(24, ChronoUnit.HOURS))) {
            throw new BusinessException("GRADE_REVISION_WINDOW_EXPIRED",
                    "Chỉ được sửa điểm trong vòng 24 giờ sau khi chấm.",
                    HttpStatus.CONFLICT);
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessException("GRADE_REVISION_REASON_REQUIRED",
                    "Cần nhập lý do khi sửa điểm bài tập.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private AssignmentSubmissionResponse toResponse(AssignmentSubmission submission) {
        Assignment assignment = submission.getAssignment();
        Course course = assignment.getCourse();
        if (course == null) {
            throw new BusinessException("ASSIGNMENT_COURSE_MISSING",
                    "Bài tự luận chưa được liên kết với khóa học.");
        }
        Instant dueAt = assignment.getDueAt();
        String status = switch (submission.getStatus()) {
            case "graded" -> "graded";
            case "returned" -> "resubmit";
            default -> "pending";
        };
        return new AssignmentSubmissionResponse(
                submission.getId(),
                assignment.getId(),
                assignment.getTitle(),
                assignment.getDescription(),
                course.getId(),
                course.getTitle(),
                submission.getStudent().getId(),
                submission.getStudent().getFullName(),
                submission.getContent(),
                readFiles(submission.getFileUrlsJson()),
                submission.effectiveAttemptNumber(),
                status,
                submission.getScore() != null ? submission.getScore().doubleValue() : null,
                assignment.getMaxScore().doubleValue(),
                submission.getFeedback(),
                submission.getSubmittedAt(),
                submission.getExpectedGradedBy(),
                submission.getGradedAt(),
                dueAt,
                submission.isLate(),
                submission.effectiveLatePenaltyPercent(),
                submission.getRawScore() != null
                        ? submission.getRawScore().doubleValue()
                        : null);
    }

    private List<AssignmentSubmissionResponse.SubmissionFile> readFiles(String json) {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return List.of();
        try {
            List<Map<String, Object>> files = objectMapper.readValue(
                    json, new TypeReference<List<Map<String, Object>>>() {});
            return files.stream()
                    .map(file -> new AssignmentSubmissionResponse.SubmissionFile(
                            stringValue(file, "name", "fileName"),
                            stringValue(file, "url", "fileUrl"),
                            previewUrl(stringValue(file, "url", "fileUrl"),
                                    stringValue(file, "type", "fileType"),
                                    stringValue(file, "name", "fileName")),
                            previewSupported(stringValue(file, "type", "fileType"),
                                    stringValue(file, "name", "fileName")),
                            stringValue(file, "type", "fileType"),
                            longValue(file, "sizeBytes", "size")))
                    .filter(file -> file.url() != null)
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String stringValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) return value.toString();
        }
        return null;
    }

    private Long longValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value instanceof Number number) return number.longValue();
            if (value != null) {
                try {
                    return Long.parseLong(value.toString());
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private void completeAssignmentRuleIfSatisfied(
            AssignmentSubmission submission, String satisfiedRule) {
        Assignment assignment = submission.getAssignment();
        Lesson lesson = assignment.getLesson();
        Course course = assignment.getCourse();
        if (lesson == null || course == null) return;
        courseProgressService.completeAssignmentLesson(
                course.getId(), submission.getStudent().getId(), lesson.getId(), satisfiedRule);
    }

    private boolean previewSupported(String type, String name) {
        String normalized = ((type == null ? "" : type) + " " + (name == null ? "" : name))
                .toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("pdf") || normalized.contains("image")
                || normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")
                || normalized.endsWith(".png") || normalized.endsWith(".webp");
    }

    private String previewUrl(String url, String type, String name) {
        return previewSupported(type, name) ? url : null;
    }

    private record SubmissionAvailability(
            String status,
            boolean canSubmit,
            int remainingAttempts) {
    }
}
