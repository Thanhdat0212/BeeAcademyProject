package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseProgressItem;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.ParentProgressAccessAudit;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ParentProgressAccessAuditRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
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
public class ParentProgressService {

    private static final int PRIVACY_CONSENT_AGE = 16;
    private static final List<String> REQUIRED_EXAM_LABELS = List.of(
            "Giữa kỳ 1",
            "Cuối kỳ 1",
            "Giữa kỳ 2",
            "Cuối kỳ 2");

    @Value("${app.parent.weekly-report.inactive-days-threshold:5}")
    private int weeklyInactiveDaysThreshold = 5;

    @Value("${app.parent.weekly-report.low-score-threshold:5.0}")
    private double weeklyLowScoreThreshold = 5.0;

    @Value("${app.parent.weekly-report.low-progress-threshold:50}")
    private int weeklyLowProgressThreshold = 50;

    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final ExamConfigRepository examConfigRepository;
    private final ExamConfigVersionService examConfigVersionService;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final ParentProgressAccessAuditRepository progressAccessAuditRepository;
    private final CertificateRepository certificateRepository;
    private final ChapterRepository chapterRepository;
    private final CourseProgressItemRepository courseProgressItemRepository;

    @Transactional
    public ChildOverviewResponse getChildOverview(AuthenticatedUser me, UUID studentId) {
        log.info("Parent {} requested overview for student {}", me.userId(), studentId);

        ParentStudentLink link = requireActiveLink(me.userId(), studentId);
        Profile student = link.getStudent();
        ProgressAccessDecision accessDecision = decideProgressAccess(link);
        auditProgressAccess(me.userId(), studentId, "view_child_overview", accessDecision);
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
                .detailAccessAllowed(accessDecision.detailAllowed())
                .sensitiveDataMasked(!accessDecision.detailAllowed())
                .detailAccessReason(accessDecision.reason())
                .build();
    }

    @Transactional
    public ChildProgressReportResponse getChildProgressReport(AuthenticatedUser me, UUID studentId) {
        return getChildProgressReport(me, studentId, null, null, null);
    }

    @Transactional
    public ChildProgressReportResponse getChildProgressReport(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        log.info("Parent {} requested detailed progress report for student {}", me.userId(), studentId);

        ParentStudentLink link = requireActiveLink(me.userId(), studentId);
        Profile student = link.getStudent();
        ProgressAccessDecision accessDecision = decideProgressAccess(link);
        auditProgressAccess(me.userId(), studentId, "view_child_progress_report", accessDecision);
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        List<ChildProgressReportResponse.CertificateRecord> certificateRecords =
                buildCertificateRecords(studentId, courseFilterId);

        if (enrollments.isEmpty()) {
            return new ChildProgressReportResponse(
                    studentId,
                    displayName(student),
                    "",
                    Instant.now(),
                    accessDecision.detailAllowed(),
                    !accessDecision.detailAllowed(),
                    accessDecision.reason(),
                    emptyWeeklySummary(),
                    List.of(),
                    List.of(),
                    certificateRecords);
        }

        List<UUID> courseIds = enrollments.stream()
                .map(Enrollment::getCourseId)
                .distinct()
                .toList();
        if (courseFilterId != null) {
            courseIds = courseIds.stream()
                    .filter(courseFilterId::equals)
                    .toList();
            enrollments = enrollments.stream()
                    .filter(enrollment -> courseFilterId.equals(enrollment.getCourseId()))
                    .toList();
        }
        if (courseIds.isEmpty()) {
            return new ChildProgressReportResponse(
                    studentId,
                    displayName(student),
                    "",
                    Instant.now(),
                    accessDecision.detailAllowed(),
                    !accessDecision.detailAllowed(),
                    accessDecision.reason(),
                    emptyWeeklySummary(),
                    List.of(),
                    List.of(),
                    certificateRecords);
        }
        Map<UUID, Enrollment> enrollmentByCourseId = enrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        enrollment -> enrollment,
                        (left, right) -> left,
                        LinkedHashMap::new));

        List<Course> courses = courseRepository.findByIdIn(courseIds);
        Map<UUID, Course> courseById = courses.stream()
                .collect(Collectors.toMap(Course::getId, course -> course));
        Map<UUID, List<Chapter>> chaptersByCourseId = Optional
                .ofNullable(chapterRepository.findWithLessonsByCourseIdIn(courseIds))
                .orElse(List.of())
                .stream()
                .collect(Collectors.groupingBy(
                        chapter -> chapter.getCourse().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));
        Map<UUID, CourseProgressItem> completedLessonById = Optional
                .ofNullable(courseProgressItemRepository.findByStudentIdAndCourseIdIn(studentId, courseIds))
                .orElse(List.of())
                .stream()
                .filter(item -> "lesson".equals(item.getItemType()))
                .collect(Collectors.toMap(
                        CourseProgressItem::getItemId,
                        Function.identity(),
                        (first, ignored) -> first,
                        LinkedHashMap::new));

        List<QuizConfig> quizConfigs = quizConfigRepository.findByCourseIds(courseIds);
        Map<UUID, List<QuizConfig>> quizConfigsByCourseId = quizConfigs.stream()
                .collect(Collectors.groupingBy(config -> config.getChapter().getCourse().getId()));
        List<ExamConfig> examConfigs = examConfigRepository.findByCourseIds(courseIds);
        Map<UUID, List<ExamConfig>> examConfigsByCourseId = examConfigs.stream()
                .collect(Collectors.groupingBy(config -> config.getCourse().getId()));

        List<QuizAttempt> quizAttempts = quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);
        List<ExamAttempt> examAttempts = examAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds);
        List<ExamAttempt> allExamAttempts = examAttemptRepository.findByStudentAndCourseIds(studentId, courseIds);
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
                        examConfigsByCourseId.getOrDefault(enrollment.getCourseId(), List.of()),
                        quizAttempts,
                        examAttempts,
                        allExamAttempts,
                        assignmentSubmissions,
                        chaptersByCourseId.getOrDefault(enrollment.getCourseId(), List.of()),
                        completedLessonById))
                .flatMap(Optional::stream)
                .toList();

        List<ChildProgressReportResponse.AssessmentRecord> allAssessments = buildAssessmentRecords(
                quizAttempts,
                examAttempts,
                assignmentSubmissions,
                courseById,
                courseStatusById,
                accessDecision.detailAllowed());
        List<ChildProgressReportResponse.AssessmentRecord> assessments = allAssessments.stream()
                .filter(record -> isWithinDateRange(record.submittedAt(), from, to))
                .toList();

        return new ChildProgressReportResponse(
                studentId,
                displayName(student),
                resolveGradeLabel(courses),
                Instant.now(),
                accessDecision.detailAllowed(),
                !accessDecision.detailAllowed(),
                accessDecision.reason(),
                buildWeeklySummary(courseItems, allAssessments),
                courseItems,
                assessments,
                certificateRecords);
    }

    @Transactional
    public byte[] exportChildProgressReportExcel(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        ChildProgressReportResponse report =
                getChildProgressReport(me, studentId, courseFilterId, from, to);
        return ParentProgressWorkbookExporter.export(report);
    }

    private ProgressAccessDecision decideProgressAccess(ParentStudentLink link) {
        Profile student = link.getStudent();
        if (link.isSensitiveDataConsentGranted()) {
            return new ProgressAccessDecision(true, "CONSENT_GRANTED");
        }

        LocalDate dateOfBirth = student.getDateOfBirth();
        if (dateOfBirth == null) {
            return new ProgressAccessDecision(false, "DOB_MISSING_REQUIRE_CONSENT");
        }

        int age = Period.between(dateOfBirth, LocalDate.now()).getYears();
        if (age >= PRIVACY_CONSENT_AGE && student.isParentPrivacyEnabled()) {
            return new ProgressAccessDecision(false, "STUDENT_16_PLUS_PRIVACY_ENABLED_REQUIRE_CONSENT");
        }

        return new ProgressAccessDecision(true, "CONSENT_NOT_REQUIRED");
    }

    private void auditProgressAccess(
            UUID parentId,
            UUID studentId,
            String action,
            ProgressAccessDecision accessDecision) {
        progressAccessAuditRepository.save(ParentProgressAccessAudit.create(
                parentId,
                studentId,
                action,
                true,
                accessDecision.detailAllowed(),
                accessDecision.reason()));
    }

    private ChildProgressReportResponse.WeeklySummary emptyWeeklySummary() {
        LocalDate periodEnd = LocalDate.now();
        LocalDate periodStart = periodEnd.minusDays(6);
        return new ChildProgressReportResponse.WeeklySummary(
                periodStart,
                periodEnd,
                "no_data",
                0,
                0,
                null,
                0,
                0,
                0,
                7,
                "no_data",
                "Chua co du lieu hoc tap trong khoang thoi gian nay.");
    }

    private ChildProgressReportResponse.WeeklySummary buildWeeklySummary(
            List<ChildProgressReportResponse.CourseProgressItem> courseItems,
            List<ChildProgressReportResponse.AssessmentRecord> assessments) {
        LocalDate periodEnd = LocalDate.now();
        LocalDate periodStart = periodEnd.minusDays(6);
        LocalDate previousPeriodStart = periodStart.minusDays(7);
        LocalDate previousPeriodEnd = periodStart.minusDays(1);
        List<ChildProgressReportResponse.AssessmentRecord> weeklyAssessments = assessments.stream()
                .filter(record -> record.submittedAt() != null)
                .filter(record -> isWithinInclusivePeriod(record.submittedAt(), periodStart, periodEnd))
                .toList();

        int currentWeekCompletedLessons = countCompletedLessons(courseItems, periodStart, periodEnd);
        int previousWeekCompletedLessons = countCompletedLessons(
                courseItems, previousPeriodStart, previousPeriodEnd);
        int previousWeekAssessments = (int) assessments.stream()
                .filter(record -> record.submittedAt() != null)
                .filter(record -> isWithinInclusivePeriod(
                        record.submittedAt(), previousPeriodStart, previousPeriodEnd))
                .count();
        int currentWeekCompletedItems = currentWeekCompletedLessons + weeklyAssessments.size();
        int previousWeekCompletedItems = previousWeekCompletedLessons + previousWeekAssessments;

        Double averageScore = weeklyAssessments.stream()
                .map(ChildProgressReportResponse.AssessmentRecord::normalizedScore)
                .filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .stream()
                .map(this::round1)
                .boxed()
                .findFirst()
                .orElse(null);
        int incompleteCourses = (int) courseItems.stream()
                .filter(course -> course.progressPct() == null || course.progressPct() < 100)
                .count();
        int incompleteLearningItems = courseItems.stream()
                .mapToInt(this::countIncompleteLearningItems)
                .sum();
        int activeDays = (int) java.util.stream.Stream.concat(
                        weeklyAssessments.stream().map(ChildProgressReportResponse.AssessmentRecord::submittedAt),
                        courseItems.stream()
                                .flatMap(course -> course.completedLessons().stream())
                                .map(ChildProgressReportResponse.LessonProgressItem::completedAt)
                                .filter(java.util.Objects::nonNull)
                                .filter(completedAt -> isWithinInclusivePeriod(
                                        completedAt, periodStart, periodEnd)))
                .map(completedAt -> completedAt.atZone(ZoneId.systemDefault()).toLocalDate())
                .distinct()
                .count();
        int inactiveDays = Math.max(0, 7 - activeDays);
        double averageProgress = courseItems.isEmpty()
                ? 0.0
                : courseItems.stream()
                .mapToInt(course -> course.progressPct() != null ? course.progressPct() : 0)
                .average()
                .orElse(0.0);

        String trend = progressTrend(currentWeekCompletedItems, previousWeekCompletedItems);
        String actionRule;
        String suggestion;
        if (courseItems.isEmpty() && currentWeekCompletedItems == 0 && previousWeekCompletedItems == 0) {
            trend = "no_data";
            actionRule = "no_data";
            suggestion = "Chua co du lieu hoc tap trong khoang thoi gian nay.";
        } else if (inactiveDays >= weeklyInactiveDaysThreshold
                && averageProgress < weeklyLowProgressThreshold) {
            actionRule = "inactive";
            suggestion = "Nen nhac hoc sinh quay lai hoc va hoan thanh cac bai danh gia con thieu.";
        } else if (averageScore != null && averageScore < weeklyLowScoreThreshold) {
            actionRule = "needs_support";
            suggestion = "Nen trao doi voi giao vien de ho tro cac noi dung co diem thap.";
        } else if ("decreasing".equals(trend)) {
            actionRule = "decreasing";
            suggestion = "Tien do dang giam so voi tuan truoc; nen sap xep lai lich hoc deu hon.";
        } else {
            actionRule = "on_track";
            suggestion = "Tiep tuc duy tri tien do hoc tap hien tai.";
        }

        return new ChildProgressReportResponse.WeeklySummary(
                periodStart,
                periodEnd,
                trend,
                currentWeekCompletedItems,
                previousWeekCompletedItems,
                averageScore,
                weeklyAssessments.size(),
                incompleteCourses,
                incompleteLearningItems,
                inactiveDays,
                actionRule,
                suggestion);
    }

    private int countCompletedLessons(
            List<ChildProgressReportResponse.CourseProgressItem> courseItems,
            LocalDate periodStart,
            LocalDate periodEnd) {
        return (int) courseItems.stream()
                .flatMap(course -> course.completedLessons().stream())
                .map(ChildProgressReportResponse.LessonProgressItem::completedAt)
                .filter(java.util.Objects::nonNull)
                .filter(completedAt -> isWithinInclusivePeriod(completedAt, periodStart, periodEnd))
                .count();
    }

    private int countIncompleteLearningItems(ChildProgressReportResponse.CourseProgressItem course) {
        int incompleteLessons = Math.max(0, course.lessonTotalCount() - course.lessonCompletedCount());
        int incompleteQuizzes = Math.max(0, course.quizTotalCount() - course.quizCompletedCount());
        int incompleteRequiredExams = (int) course.requiredExams().stream()
                .filter(exam -> !"passed".equals(exam.status()))
                .count();
        return incompleteLessons + incompleteQuizzes + incompleteRequiredExams;
    }

    private String progressTrend(int currentWeekCompletedItems, int previousWeekCompletedItems) {
        if (currentWeekCompletedItems > previousWeekCompletedItems) {
            return "increasing";
        }
        if (currentWeekCompletedItems < previousWeekCompletedItems) {
            return "decreasing";
        }
        return "stable";
    }

    private boolean isWithinInclusivePeriod(Instant value, LocalDate from, LocalDate to) {
        LocalDate localDate = value.atZone(ZoneId.systemDefault()).toLocalDate();
        return !localDate.isBefore(from) && !localDate.isAfter(to);
    }

    private boolean isWithinDateRange(Instant value, LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return true;
        }
        if (value == null) {
            return false;
        }
        LocalDate localDate = value.atZone(ZoneId.systemDefault()).toLocalDate();
        if (from != null && localDate.isBefore(from)) {
            return false;
        }
        return to == null || !localDate.isAfter(to);
    }

    private ParentStudentLink requireActiveLink(UUID parentId, UUID studentId) {
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(parentId, studentId)
                .orElseThrow(() -> new BusinessException(
                        "LINK_NOT_FOUND",
                        "Không tìm thấy thông tin liên kết giữa tài khoản của bạn và học sinh này.",
                        HttpStatus.NOT_FOUND));

        if (link.getStatus() != ParentStudentLinkStatus.ACTIVE) {
            throw new BusinessException(
                    "LINK_NOT_ACTIVE",
                    "Liên kết này không còn ở trạng thái hoạt động.",
                    HttpStatus.CONFLICT);
        }

        return link;
    }

    private record ProgressAccessDecision(boolean detailAllowed, String reason) {}

    private Optional<ChildProgressReportResponse.CourseProgressItem> toCourseProgressItem(
            Enrollment enrollment,
            Course course,
            List<QuizConfig> quizConfigs,
            List<ExamConfig> examConfigs,
            List<QuizAttempt> quizAttempts,
            List<ExamAttempt> examAttempts,
            List<ExamAttempt> allExamAttempts,
            List<AssignmentSubmission> assignmentSubmissions,
            List<Chapter> chapters,
            Map<UUID, CourseProgressItem> completedLessonById) {
        if (course == null) {
            return Optional.empty();
        }

        UUID courseId = course.getId();
        UUID courseVersionId = enrollment.getCourseVersionId();
        List<ExamConfig> versionExamConfigs = examConfigVersionService.forEnrollment(enrollment);
        Set<UUID> versionExamConfigIds = versionExamConfigs.stream()
                .map(ExamConfig::getId)
                .collect(Collectors.toSet());
        List<QuizAttempt> courseQuizAttempts = quizAttempts.stream()
                .filter(attempt -> attempt.getQuizConfig().getChapter().getCourse().getId().equals(courseId))
                .toList();
        List<ExamAttempt> courseExamAttempts = examAttempts.stream()
                .filter(attempt -> attempt.getExamConfig().getCourse().getId().equals(courseId))
                .filter(attempt -> versionExamConfigIds.contains(attempt.getExamConfig().getId()))
                .toList();
        List<ExamAttempt> courseAllExamAttempts = allExamAttempts.stream()
                .filter(attempt -> attempt.getExamConfig().getCourse().getId().equals(courseId))
                .filter(attempt -> versionExamConfigIds.contains(attempt.getExamConfig().getId()))
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
        List<ChildProgressReportResponse.LessonProgressItem> completedLessons =
                buildCompletedLessonRecords(chapters, completedLessonById);
        int totalLessonCount = chapters.stream()
                .map(Chapter::getLessons)
                .filter(java.util.Objects::nonNull)
                .mapToInt(List::size)
                .sum();
        List<ChildProgressReportResponse.RequiredExamResult> requiredExams =
                buildRequiredExamResults(versionExamConfigs, courseAllExamAttempts);

        return Optional.of(new ChildProgressReportResponse.CourseProgressItem(
                courseId,
                courseVersionId,
                course.getTitle(),
                course.getTeacher() != null ? displayName(course.getTeacher()) : null,
                toCourseStatus(enrollment),
                enrollment.getProgressPct() != null ? enrollment.getProgressPct() : 0,
                enrollment.getEnrolledAt(),
                enrollment.getProgressUpdatedAt(),
                toGradeList(course),
                completedLessons.size(),
                totalLessonCount,
                latestQuizScoresByConfig.size(),
                quizConfigs.size(),
                averageQuizScore,
                latestQuizScore,
                latestExamScore,
                latestAssignmentScore,
                completedLessons,
                requiredExams));
    }

    private List<ChildProgressReportResponse.LessonProgressItem> buildCompletedLessonRecords(
            List<Chapter> chapters,
            Map<UUID, CourseProgressItem> completedLessonById) {
        if (chapters == null || chapters.isEmpty() || completedLessonById.isEmpty()) {
            return List.of();
        }

        return chapters.stream()
                .sorted(Comparator.comparing(
                        Chapter::getPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .flatMap(chapter -> chapter.getLessons().stream()
                        .sorted(Comparator.comparing(
                                Lesson::getPosition,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(lesson -> toLessonProgressItem(chapter, lesson, completedLessonById.get(lesson.getId())))
                        .flatMap(Optional::stream))
                .toList();
    }

    private Optional<ChildProgressReportResponse.LessonProgressItem> toLessonProgressItem(
            Chapter chapter,
            Lesson lesson,
            CourseProgressItem completed) {
        if (completed == null) {
            return Optional.empty();
        }
        return Optional.of(new ChildProgressReportResponse.LessonProgressItem(
                lesson.getId(),
                chapter.getId(),
                chapter.getTitle(),
                chapter.getPosition(),
                lesson.getTitle(),
                lesson.getPosition(),
                lesson.getDurationSec(),
                completed.getCompletedAt()));
    }

    private List<ChildProgressReportResponse.AssessmentRecord> buildAssessmentRecords(
            List<QuizAttempt> quizAttempts,
            List<ExamAttempt> examAttempts,
            List<AssignmentSubmission> assignmentSubmissions,
            Map<UUID, Course> courseById,
            Map<UUID, String> courseStatusById,
            boolean detailAccessAllowed) {
        List<ChildProgressReportResponse.AssessmentRecord> records = quizAttempts.stream()
                .map(attempt -> toQuizAssessmentRecord(attempt, courseStatusById))
                .collect(Collectors.toList());

        records.addAll(examAttempts.stream()
                .map(attempt -> toExamAssessmentRecord(attempt, courseStatusById, detailAccessAllowed))
                .toList());

        records.addAll(assignmentSubmissions.stream()
                .map(submission -> toAssignmentAssessmentRecord(
                        submission,
                        courseById,
                        courseStatusById,
                        detailAccessAllowed))
                .toList());

        return records.stream()
                .sorted(Comparator.comparing(
                        ChildProgressReportResponse.AssessmentRecord::submittedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private List<ChildProgressReportResponse.CertificateRecord> buildCertificateRecords(
            UUID studentId,
            UUID courseFilterId) {
        List<Certificate> certificates = Optional.ofNullable(certificateRepository.findByStudentWithCourse(studentId))
                .orElse(List.of());
        return certificates.stream()
                .filter(certificate -> courseFilterId == null
                        || courseFilterId.equals(certificate.getCourse().getId()))
                .map(this::toCertificateRecord)
                .toList();
    }

    private ChildProgressReportResponse.CertificateRecord toCertificateRecord(Certificate certificate) {
        Course course = certificate.getCourse();
        return new ChildProgressReportResponse.CertificateRecord(
                certificate.getId(),
                course != null ? course.getId() : null,
                course != null ? course.getTitle() : "KhÃ³a há»c",
                course != null && course.getTeacher() != null
                        ? displayName(course.getTeacher(), "GiÃ¡o viÃªn")
                        : null,
                certificate.getStatus() != null ? certificate.getStatus().name() : null,
                certificate.getCertificateNo(),
                certificate.getVerificationCode(),
                certificate.getVersionNo(),
                certificate.getIssuedAt(),
                certificate.getRevokedAt(),
                certificate.getReviewNote());
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
            Map<UUID, String> courseStatusById,
            boolean detailAccessAllowed) {
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
                detailAccessAllowed ? attempt.getTeacherFeedback() : null,
                attempt.getSubmittedAt());
    }

    private ChildProgressReportResponse.AssessmentRecord toAssignmentAssessmentRecord(
            AssignmentSubmission submission,
            Map<UUID, Course> courseById,
            Map<UUID, String> courseStatusById,
            boolean detailAccessAllowed) {
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
                detailAccessAllowed ? submission.getFeedback() : null,
                submission.getSubmittedAt());
    }

    private List<ChildProgressReportResponse.RequiredExamResult> buildRequiredExamResults(
            List<ExamConfig> examConfigs,
            List<ExamAttempt> examAttempts) {
        Map<Integer, ExamConfig> configBySlot = examConfigs.stream()
                .filter(config -> config.getSlotIndex() != null)
                .filter(config -> config.getSlotIndex() >= 0 && config.getSlotIndex() < REQUIRED_EXAM_LABELS.size())
                .collect(Collectors.toMap(
                        ExamConfig::getSlotIndex,
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new));
        Map<UUID, ExamAttempt> latestAttemptByConfigId = new LinkedHashMap<>();
        for (ExamAttempt attempt : examAttempts) {
            UUID configId = attempt.getExamConfig().getId();
            latestAttemptByConfigId.putIfAbsent(configId, attempt);
        }

        return java.util.stream.IntStream.range(0, REQUIRED_EXAM_LABELS.size())
                .mapToObj(slot -> toRequiredExamResult(slot, configBySlot.get(slot), latestAttemptByConfigId))
                .toList();
    }

    private ChildProgressReportResponse.RequiredExamResult toRequiredExamResult(
            int slot,
            ExamConfig config,
            Map<UUID, ExamAttempt> latestAttemptByConfigId) {
        if (config == null) {
            return new ChildProgressReportResponse.RequiredExamResult(
                    slot,
                    REQUIRED_EXAM_LABELS.get(slot),
                    null,
                    null,
                    "not_configured",
                    null,
                    null,
                    null,
                    null,
                    null,
                    null);
        }

        ExamAttempt attempt = latestAttemptByConfigId.get(config.getId());
        if (attempt == null) {
            return new ChildProgressReportResponse.RequiredExamResult(
                    slot,
                    REQUIRED_EXAM_LABELS.get(slot),
                    config.getName(),
                    config.getExamType(),
                    "not_submitted",
                    config.getId(),
                    config.getCourseVersionId(),
                    null,
                    null,
                    null,
                    null);
        }

        Double scorePercent = attempt.getEffectiveScorePercent() == null
                ? null
                : round1(attempt.getEffectiveScorePercent().doubleValue());
        return new ChildProgressReportResponse.RequiredExamResult(
                slot,
                REQUIRED_EXAM_LABELS.get(slot),
                config.getName(),
                config.getExamType(),
                requiredExamStatus(attempt),
                config.getId(),
                config.getCourseVersionId(),
                scorePercent,
                scorePercent == null ? null : round1(scorePercent / 10.0),
                attempt.getPassed(),
                attempt.getSubmittedAt());
    }

    private String requiredExamStatus(ExamAttempt attempt) {
        if (attempt.getSubmittedAt() == null) {
            return "in_progress";
        }
        if (attempt.getPassed() == null) {
            return "pending_grading";
        }
        return Boolean.TRUE.equals(attempt.getPassed()) ? "passed" : "failed";
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
