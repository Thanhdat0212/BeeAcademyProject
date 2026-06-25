package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SendParentLinkInvitationRequest;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.dto.response.ParentLinkInvitationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentService {

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final ParentLinkInvitationEmailService parentLinkInvitationEmailService;

    @Transactional(readOnly = true)
    public List<LinkedStudentResponse> getLinkedChildren(AuthenticatedUser me) {
        log.info("Parent {} requested linked children list", me.userId());

        List<ParentStudentLink> links = linkRepository.findByIdParentIdAndStatusOrderByInvitedAtDesc(
                me.userId(),
                ParentStudentLinkStatus.ACCEPTED.toDbValue());
        return links.stream()
                .map(link -> {
                    Profile student = link.getStudent();
                    return LinkedStudentResponse.builder()
                            .id(student.getId())
                            .name(student.getFullName())
                            .avatarUrl(student.getAvatarUrl())
                            .code("")
                            .grade("")
                            .build();
                })
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
        if (existingLink != null && existingLink.getStatus() == ParentStudentLinkStatus.ACCEPTED) {
            throw new BusinessException(
                    "ALREADY_LINKED",
                    "Tài khoản học sinh này đã liên kết với bạn rồi.",
                    HttpStatus.CONFLICT);
        }

        Profile parent = requireParentProfile(me.userId());
        ParentStudentLink link = existingLink == null
                ? ParentStudentLink.createPendingInvitation(parent, student)
                : existingLink;

        if (existingLink != null) {
            existingLink.markPending();
        }

        ParentStudentLink savedLink = linkRepository.saveAndFlush(link);
        parentLinkInvitationEmailService.sendInvitation(
                normalizedEmail,
                displayName(student),
                displayName(parent));

        return toParentLinkInvitationResponse(savedLink, normalizedEmail);
    }

    @Transactional
    public void unlinkStudent(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested unlink for student {}", me.userId(), studentId);

        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElseThrow(() -> new BusinessException(
                        "LINK_NOT_FOUND",
                        "Không tìm thấy thông tin liên kết giữa tài khoản của bạn và học sinh này.",
                        HttpStatus.NOT_FOUND));

        linkRepository.delete(link);
        log.info("Unlinked student {} from parent {}", studentId, me.userId());
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

    private Profile requireParentProfile(UUID parentId) {
        return profileRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", parentId));
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
                link.getStatus().toApiValue(),
                link.getInvitedAt(),
                link.getRespondedAt());
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
        if (profile == null || profile.getFullName() == null || profile.getFullName().isBlank()) {
            return "Học sinh";
        }
        return profile.getFullName();
    }

    private double round1(double value) {
        return BigDecimal.valueOf(value)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
