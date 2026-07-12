package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateAssignmentRequest;
import com.beeacademy.backend.dto.request.GradeAssignmentSubmissionRequest;
import com.beeacademy.backend.dto.request.SubmitAssignmentRequest;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final ChapterRepository chapterRepository;
    private final LessonRepository lessonRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AssignmentSubmissionResponse> listTeacherSubmissions(AuthenticatedUser me) {
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
                request.maxScore(), request.dueAt());
        return toTeacherResponse(assignmentRepository.save(assignment));
    }

    @Transactional(readOnly = true)
    public List<TeacherAssignmentResponse> listTeacherAssignments(AuthenticatedUser me) {
        return assignmentRepository.findAllByTeacherId(me.userId()).stream()
                .map(this::toTeacherResponse)
                .toList();
    }

    @Transactional
    public void deleteAssignment(UUID assignmentId, AuthenticatedUser me) {
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

        String filesJson = writeFiles(request.files());
        AssignmentSubmission submission = submissionRepository
                .findByAssignmentIdAndStudentId(assignmentId, me.userId())
                .map(existing -> {
                    if ("graded".equals(existing.getStatus())) {
                        throw new BusinessException("ALREADY_GRADED",
                                "Bài đã được chấm điểm, không thể nộp lại.");
                    }
                    existing.resubmit(request.content(), filesJson);
                    return existing;
                })
                .orElseGet(() -> {
                    Profile student = profileRepository.findById(me.userId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "Profile", me.userId()));
                    return AssignmentSubmission.submit(
                            assignment, student, request.content(), filesJson);
                });
        return toStudentResponse(assignment, submissionRepository.save(submission));
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
            Instant dueAt = assignment.getDueAt();
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
                    submission.getGradedAt(),
                    dueAt != null && submission.getSubmittedAt().isAfter(dueAt));
        }
        return new StudentAssignmentResponse(
                assignment.getId(),
                assignment.getTitle(),
                assignment.getDescription(),
                assignment.getMaxScore(),
                assignment.getDueAt(),
                chapter != null ? chapter.getId() : null,
                chapter != null ? chapter.getTitle() : null,
                assignment.getLesson() != null ? assignment.getLesson().getId() : null,
                assignment.getLesson() != null ? assignment.getLesson().getTitle() : null,
                mySubmission);
    }

    @Transactional
    public AssignmentSubmissionResponse gradeSubmission(
            UUID submissionId,
            AuthenticatedUser me,
            GradeAssignmentSubmissionRequest request) {
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
        submission.grade(request.score().intValue(), request.feedback(), teacher);
        return toResponse(submissionRepository.save(submission));
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
                1,
                status,
                submission.getScore() != null ? submission.getScore().doubleValue() : null,
                assignment.getMaxScore().doubleValue(),
                submission.getFeedback(),
                submission.getSubmittedAt(),
                submission.getGradedAt(),
                dueAt,
                dueAt != null && submission.getSubmittedAt().isAfter(dueAt));
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
}
