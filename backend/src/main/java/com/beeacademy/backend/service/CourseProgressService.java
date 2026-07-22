package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest;
import com.beeacademy.backend.dto.response.CourseProgressResponse;
import com.beeacademy.backend.dto.response.StudentLearningProgressResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseProgressItem;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.model.StudentVideoProgress;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CourseProgressService {

    private static final String ITEM_LESSON = "lesson";
    private static final String ITEM_QUIZ = "quiz";
    private static final List<String> REQUIRED_EXAM_LABELS = List.of(
            "Giữa kỳ 1", "Cuối kỳ 1", "Giữa kỳ 2", "Cuối kỳ 2");
    private static final Pattern WATCHED_SEGMENT_PATTERN = Pattern.compile(
            "\\\"startSec\\\"\\s*:\\s*(\\d+).*?\\\"endSec\\\"\\s*:\\s*(\\d+)");
    private final CourseProgressItemRepository progressRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final ChapterRepository chapterRepository;
    private final LessonRepository lessonRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ExamConfigRepository examConfigRepository;
    private final OrderItemRepository orderItemRepository;
    private final CertificateService certificateService;
    private final CourseVersionSnapshotService courseVersionSnapshotService;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final StudentVideoProgressRepository studentVideoProgressRepository;

    @Transactional(readOnly = true)
    public CourseProgressResponse getProgress(UUID courseId, AuthenticatedUser me) {
        requireEnrolled(me.userId(), courseId);
        return buildResponse(me.userId(), courseId);
    }

    @Transactional(readOnly = true)
    public StudentLearningProgressResponse getLearningProgress(AuthenticatedUser me) {
        UUID studentId = me.userId();
        Map<UUID, Enrollment> enrollmentByCourse = enrollmentRepository.findByStudentId(studentId)
                .stream()
                .collect(Collectors.toMap(Enrollment::getCourseId, enrollment -> enrollment));
        LinkedHashSet<UUID> ownedCourseIds = new LinkedHashSet<>(enrollmentByCourse.keySet());
        ownedCourseIds.addAll(orderItemRepository.findPaidCourseIdsByStudent(studentId, OrderStatus.PAID.toDbValue()));

        if (ownedCourseIds.isEmpty()) {
            return new StudentLearningProgressResponse(
                    0, 0, 0, 0, 0, 0, List.of(), null, 0L);
        }

        List<UUID> courseIds = ownedCourseIds.stream().toList();
        List<Course> courses = courseRepository.findByIdIn(courseIds);
        Map<UUID, Integer> progressByCourse = calculateProgressForCourses(studentId, courseIds);

        Map<UUID, List<ExamConfig>> examConfigsByCourse = examConfigRepository.findByCourseIds(courseIds)
                .stream()
                .collect(Collectors.groupingBy(config -> config.getCourse().getId()));
        Map<UUID, List<ExamAttempt>> examAttemptsByCourse = examAttemptRepository
                .findByStudentAndCourseIds(studentId, courseIds)
                .stream()
                .collect(Collectors.groupingBy(attempt -> attempt.getExamConfig().getCourse().getId()));

        Map<UUID, List<AssignmentSubmission>> assignmentsByCourse =
                assignmentSubmissionRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds)
                        .stream()
                        .filter(submission -> assignmentCourseId(submission) != null)
                        .collect(Collectors.groupingBy(this::assignmentCourseId));
        Map<UUID, List<StudentVideoProgress>> videoProgressByCourse =
                studentVideoProgressRepository.findByStudentAndCourseIds(studentId, courseIds)
                        .stream()
                        .collect(Collectors.groupingBy(progress ->
                                progress.getLesson().getChapter().getCourse().getId()));

        List<CourseProgressItem> completedItems =
                progressRepository.findByStudentIdAndCourseIdIn(studentId, courseIds);
        Map<UUID, CourseProgressItem> completedByItemId = completedItems.stream()
                .collect(Collectors.toMap(
                        CourseProgressItem::getItemId,
                        item -> item,
                        (first, ignored) -> first));

        Map<UUID, List<QuizConfig>> quizConfigsByCourse = quizConfigRepository.findByCourseIds(courseIds)
                .stream()
                .collect(Collectors.groupingBy(config -> config.getChapter().getCourse().getId()));
        Map<UUID, QuizConfig> quizByChapter = quizConfigsByCourse.values().stream()
                .flatMap(List::stream)
                .collect(Collectors.toMap(config -> config.getChapter().getId(), config -> config));

        Map<UUID, QuizAttempt> latestQuizByConfig = new HashMap<>();
        quizAttemptRepository.findSubmittedByStudentAndCourseIds(studentId, courseIds)
                .forEach(attempt -> latestQuizByConfig.putIfAbsent(
                        attempt.getQuizConfig().getId(), attempt));

        // 1 query cho tất cả khóa thay vì 1 query/khóa (giảm độ trễ trước khi gọi Gemini)
        Map<UUID, List<Chapter>> chaptersByCourse =
                chapterRepository.findWithLessonsByCourseIdIn(courseIds).stream()
                        .collect(Collectors.groupingBy(chapter -> chapter.getCourse().getId()));

        List<StudentLearningProgressResponse.CourseProgressDetail> courseDetails = courses.stream()
                .map(course -> buildCourseProgressDetail(
                        course,
                        enrollmentByCourse.get(course.getId()),
                        progressByCourse.getOrDefault(course.getId(), 0),
                        completedByItemId,
                        quizByChapter,
                        latestQuizByConfig,
                        examConfigsByCourse.getOrDefault(course.getId(), List.of()),
                        examAttemptsByCourse.getOrDefault(course.getId(), List.of()),
                        chaptersByCourse.getOrDefault(course.getId(), List.of()),
                        assignmentsByCourse.getOrDefault(course.getId(), List.of()),
                        videoProgressByCourse.getOrDefault(course.getId(), List.of())))
                .toList();

        int totalLessons = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::totalLessons).sum();
        int completedLessons = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::completedLessons).sum();
        int totalQuizzes = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::totalQuizzes).sum();
        int completedQuizzes = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::completedQuizzes).sum();
        int averageProgress = (int) Math.round(courseDetails.stream()
                .mapToInt(StudentLearningProgressResponse.CourseProgressDetail::progressPct)
                .average()
                .orElse(0.0));
        Double averageScore = averageNullable(courseDetails.stream()
                .map(StudentLearningProgressResponse.CourseProgressDetail::averageScorePercent)
                .filter(Objects::nonNull)
                .toList());
        long totalStudyTimeSec = courseDetails.stream()
                .map(StudentLearningProgressResponse.CourseProgressDetail::studyTimeSec)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();

        return new StudentLearningProgressResponse(
                courseDetails.size(),
                averageProgress,
                completedLessons,
                totalLessons,
                completedQuizzes,
                totalQuizzes,
                courseDetails,
                averageScore,
                totalStudyTimeSec);
    }

    @Transactional
    public CourseProgressResponse completeItem(
            UUID courseId,
            AuthenticatedUser me,
            CompleteCourseProgressItemRequest request
    ) {
        requireEnrolled(me.userId(), courseId);
        validateItemBelongsToCourse(
                courseId, request.itemId(), request.itemType(), me.userId());

        if (ITEM_LESSON.equals(request.itemType())) {
            Lesson lesson = lessonRepository.findById(request.itemId()).orElse(null);
            // existsByIdAndCourseId đã xác nhận ownership; null chỉ xảy ra ở
            // mock/legacy schema, khi đó giữ tương thích với flow cũ.
            if (lesson != null && isVideoLesson(lesson)) {
                throw new BusinessException(
                        "VIDEO_COMPLETION_REQUIRES_WATCH_THRESHOLD",
                        "Video chỉ được hoàn thành sau khi đã xem đủ ít nhất 90% thời lượng duy nhất.",
                        HttpStatus.BAD_REQUEST);
            }
            if (lesson != null) validateNonVideoCompletionRule(lesson);
        }

        return recordProgressItem(courseId, me, request.itemId(), request.itemType());
    }

    /** Chỉ được gọi sau khi StudentVideoProgressService đã xác nhận đủ 90% đoạn xem duy nhất. */
    @Transactional
    public CourseProgressResponse completeVideoLessonAfterWatch(
            UUID courseId, UUID lessonId, AuthenticatedUser me) {
        requireEnrolled(me.userId(), courseId);
        validateItemBelongsToCourse(courseId, lessonId, ITEM_LESSON, me.userId());
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));
        if (!isVideoLesson(lesson)) {
            throw new BusinessException(
                    "INVALID_VIDEO_LESSON",
                    "Nội dung này không phải video.",
                    HttpStatus.BAD_REQUEST);
        }
        return recordProgressItem(courseId, me, lessonId, ITEM_LESSON);
    }

    /**
     * Records a non-video lesson only after AssignmentService has produced the
     * evidence required by the configured completion rule.
     */
    @Transactional
    public void completeAssignmentLesson(
            UUID courseId,
            UUID studentId,
            UUID lessonId,
            String satisfiedRule) {
        requireEnrolled(studentId, courseId);
        Lesson lesson = lessonRepository.findWithChapterAndCourseById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));
        if (!lesson.getChapter().getCourse().getId().equals(courseId)) {
            throw new BusinessException(
                    "INVALID_PROGRESS_ITEM",
                    "Bài học không thuộc khóa học đã chọn.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!Objects.equals(satisfiedRule, lesson.getCompletionRule())
                || !("ASSIGNMENT_SUBMITTED".equals(satisfiedRule)
                || "ASSIGNMENT_PASSED".equals(satisfiedRule))) {
            return;
        }
        recordProgressItem(courseId, studentId, lessonId, ITEM_LESSON);
    }

    private CourseProgressResponse recordProgressItem(
            UUID courseId, AuthenticatedUser me, UUID itemId, String itemType) {
        return recordProgressItem(courseId, me.userId(), itemId, itemType);
    }

    private CourseProgressResponse recordProgressItem(
            UUID courseId, UUID studentId, UUID itemId, String itemType) {

        boolean exists = progressRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                studentId, courseId, itemId, itemType
        );
        if (!exists) {
            progressRepository.save(CourseProgressItem.create(
                    studentId, courseId, itemId, itemType
            ));
        }

        int progressPct = calculateProgressPct(studentId, courseId);
        enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)
                .ifPresent(enrollment -> enrollment.updateProgress(progressPct));
        if (progressPct >= 100) {
            certificateService.tryIssueAfterProgress(studentId, courseId);
        }

        return buildResponse(studentId, courseId);
    }

    private boolean isVideoLesson(Lesson lesson) {
        return lesson.getVideoStoragePath() != null
                || lesson.getVideoUrl() != null
                || lesson.getVideoEmbedUrl() != null;
    }

    private void validateNonVideoCompletionRule(Lesson lesson) {
        String rule = lesson.getCompletionRule();
        if (rule == null || rule.isBlank()) {
            throw new BusinessException(
                    "COMPLETION_RULE_MISSING",
                    "Bài học chưa được cấu hình điều kiện hoàn thành.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!"DOCUMENT_OPENED".equals(rule) && !"MARK_AS_COMPLETE".equals(rule)) {
            throw new BusinessException(
                    "COMPLETION_RULE_REQUIRES_ASSIGNMENT",
                    "Bài học chỉ được hoàn thành sau khi nộp hoặc đạt bài tập.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    public Map<UUID, Integer> calculateProgressForCourses(UUID studentId, List<UUID> courseIds) {
        if (courseIds == null || courseIds.isEmpty()) return Map.of();

        Map<UUID, Long> completedByCourse = progressRepository
                .countCompletedByStudentAndCourseIds(studentId, courseIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));

        Map<UUID, Long> totalByCourse = courseRepository.countProgressItemsByCourseIds(courseIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
        Map<UUID, Enrollment> enrollmentByCourse = enrollmentRepository.findByStudentId(studentId)
                .stream()
                .filter(enrollment -> courseIds.contains(enrollment.getCourseId()))
                .collect(Collectors.toMap(Enrollment::getCourseId, enrollment -> enrollment));

        return courseIds.stream().collect(Collectors.toMap(
                courseId -> courseId,
                courseId -> {
                    long total = resolveProgressItemCount(
                            enrollmentByCourse.get(courseId),
                            Math.max(totalByCourse.getOrDefault(courseId, 0L), 0L));
                    if (total == 0) return 0;
                    long completed = Math.min(completedByCourse.getOrDefault(courseId, 0L), total);
                    return (int) Math.round((completed * 100.0) / total);
                }
        ));
    }

    /**
     * Tiến độ dùng riêng cho UC13: số bài học đã hoàn thành / tổng số bài học.
     * Quiz không được tính vào mẫu số của thẻ danh sách khóa đã mua.
     */
    public Map<UUID, Integer> calculateLessonProgressForCourses(UUID studentId, List<UUID> courseIds) {
        if (courseIds == null || courseIds.isEmpty()) return Map.of();

        Map<UUID, Long> completedByCourse = progressRepository
                .countCompletedLessonsByStudentAndCourseIds(studentId, courseIds)
                .stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
        Map<UUID, Long> totalByCourse = courseRepository.countLessonsByCourseIds(courseIds)
                .stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
        Map<UUID, Enrollment> enrollmentByCourse = enrollmentRepository.findByStudentId(studentId)
                .stream()
                .filter(enrollment -> courseIds.contains(enrollment.getCourseId()))
                .collect(Collectors.toMap(Enrollment::getCourseId, enrollment -> enrollment));

        return courseIds.stream().collect(Collectors.toMap(
                courseId -> courseId,
                courseId -> {
                    long total = resolveLessonCount(
                            enrollmentByCourse.get(courseId),
                            totalByCourse.getOrDefault(courseId, 0L));
                    if (total == 0) return 0;
                    long completed = Math.min(completedByCourse.getOrDefault(courseId, 0L), total);
                    return (int) Math.round((completed * 100.0) / total);
                }
        ));
    }

    private CourseProgressResponse buildResponse(UUID studentId, UUID courseId) {
        List<CourseProgressItem> items = progressRepository.findByStudentIdAndCourseId(studentId, courseId);
        List<UUID> lessonIds = items.stream()
                .filter(item -> ITEM_LESSON.equals(item.getItemType()))
                .map(CourseProgressItem::getItemId)
                .toList();
        List<UUID> quizIds = items.stream()
                .filter(item -> ITEM_QUIZ.equals(item.getItemType()))
                .map(CourseProgressItem::getItemId)
                .toList();
        return new CourseProgressResponse(courseId, calculateProgressPct(studentId, courseId), lessonIds, quizIds);
    }

    private StudentLearningProgressResponse.CourseProgressDetail buildCourseProgressDetail(
            Course course,
            Enrollment enrollment,
            Integer progressPct,
            Map<UUID, CourseProgressItem> completedByItemId,
            Map<UUID, QuizConfig> quizByChapter,
            Map<UUID, QuizAttempt> latestQuizByConfig,
            List<ExamConfig> examConfigs,
            List<ExamAttempt> examAttempts,
            List<Chapter> chapters,
            List<AssignmentSubmission> assignmentSubmissions,
            List<StudentVideoProgress> videoProgress
    ) {
        List<StudentLearningProgressResponse.ChapterProgressDetail> chapterDetails = chapters.stream()
                .map(chapter -> buildChapterProgressDetail(
                        chapter,
                        completedByItemId,
                        quizByChapter.get(chapter.getId()),
                        latestQuizByConfig))
                .toList();
        int totalLessons = chapterDetails.stream()
                .mapToInt(StudentLearningProgressResponse.ChapterProgressDetail::totalLessons)
                .sum();
        int completedLessons = chapterDetails.stream()
                .mapToInt(StudentLearningProgressResponse.ChapterProgressDetail::completedLessons)
                .sum();
        int totalQuizzes = (int) chapterDetails.stream()
                .filter(StudentLearningProgressResponse.ChapterProgressDetail::quizConfigured)
                .count();
        int completedQuizzes = (int) chapterDetails.stream()
                .filter(StudentLearningProgressResponse.ChapterProgressDetail::quizCompleted)
                .count();
        Double latestQuizScore = chapterDetails.stream()
                .filter(chapter -> chapter.latestQuizSubmittedAt() != null && chapter.latestQuizScore() != null)
                .max(Comparator.comparing(StudentLearningProgressResponse.ChapterProgressDetail::latestQuizSubmittedAt))
                .map(StudentLearningProgressResponse.ChapterProgressDetail::latestQuizScore)
                .orElse(null);
        List<StudentLearningProgressResponse.RequiredExamProgress> requiredExams =
                buildRequiredExamProgress(enrollment, examConfigs, examAttempts);
        int passedRequiredExams = (int) requiredExams.stream()
                .filter(exam -> Boolean.TRUE.equals(exam.passed()))
                .count();
        boolean allRequiredExamsPassed = passedRequiredExams == REQUIRED_EXAM_LABELS.size();
        boolean finalExamPassed = requiredExams.stream()
                .filter(exam -> exam.slotIndex() == REQUIRED_EXAM_LABELS.size() - 1)
                .anyMatch(exam -> Boolean.TRUE.equals(exam.passed()));
        List<StudentLearningProgressResponse.AssignmentProgress> assignments = assignmentSubmissions.stream()
                .map(this::toAssignmentProgress)
                .sorted(Comparator.comparing(
                        StudentLearningProgressResponse.AssignmentProgress::submittedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<Double> assessmentScores = new java.util.ArrayList<>();
        chapterDetails.stream()
                .map(StudentLearningProgressResponse.ChapterProgressDetail::latestQuizScore)
                .filter(Objects::nonNull)
                .map(score -> Math.min(100.0, score * 10.0))
                .forEach(assessmentScores::add);
        requiredExams.stream()
                .map(StudentLearningProgressResponse.RequiredExamProgress::scorePercent)
                .filter(Objects::nonNull)
                .forEach(assessmentScores::add);
        assignments.stream()
                .map(StudentLearningProgressResponse.AssignmentProgress::normalizedScorePercent)
                .filter(Objects::nonNull)
                .forEach(assessmentScores::add);
        Double averageScorePercent = averageNullable(assessmentScores);
        long studyTimeSec = videoProgress.stream()
                .mapToLong(this::uniqueWatchedDurationSec)
                .sum();
        return new StudentLearningProgressResponse.CourseProgressDetail(
                course.getId(),
                enrollment != null ? enrollment.getCourseVersionId() : null,
                course.getSlug(),
                course.getTitle(),
                course.getThumbnailUrl(),
                course.getCategory() != null ? course.getCategory().getName() : null,
                course.getTeacher() != null ? course.getTeacher().getFullName() : null,
                progressPct != null ? progressPct : 0,
                completedLessons,
                totalLessons,
                completedQuizzes,
                totalQuizzes,
                latestQuizScore,
                finalExamPassed,
                allRequiredExamsPassed,
                passedRequiredExams,
                requiredExams,
                enrollment != null ? enrollment.getEnrolledAt() : null,
                chapterDetails,
                averageScorePercent,
                studyTimeSec,
                assignments);
    }

    private List<StudentLearningProgressResponse.RequiredExamProgress> buildRequiredExamProgress(
            Enrollment enrollment,
            List<ExamConfig> examConfigs,
            List<ExamAttempt> examAttempts
    ) {
        UUID enrollmentVersionId = enrollment != null ? enrollment.getCourseVersionId() : null;
        Map<Integer, ExamConfig> configBySlot = new LinkedHashMap<>();

        // Prefer the enrollment version. A null-version config is accepted only as a
        // legacy fallback; a config belonging to another explicit version is never mixed in.
        for (ExamConfig config : examConfigs) {
            Integer slot = config.getSlotIndex();
            if (slot == null || slot < 0 || slot >= REQUIRED_EXAM_LABELS.size()) continue;
            if (enrollmentVersionId == null || enrollmentVersionId.equals(config.getCourseVersionId())) {
                configBySlot.put(slot, config);
            }
        }
        if (enrollmentVersionId != null) {
            for (ExamConfig config : examConfigs) {
                Integer slot = config.getSlotIndex();
                if (slot == null || slot < 0 || slot >= REQUIRED_EXAM_LABELS.size()) continue;
                if (config.getCourseVersionId() == null) {
                    configBySlot.putIfAbsent(slot, config);
                }
            }
        }

        Map<UUID, List<ExamAttempt>> attemptsByConfig = examAttempts.stream()
                .collect(Collectors.groupingBy(attempt -> attempt.getExamConfig().getId()));

        return java.util.stream.IntStream.range(0, REQUIRED_EXAM_LABELS.size())
                .mapToObj(slot -> toRequiredExamProgress(
                        slot,
                        enrollmentVersionId,
                        configBySlot.get(slot),
                        attemptsByConfig))
                .toList();
    }

    private StudentLearningProgressResponse.RequiredExamProgress toRequiredExamProgress(
            int slot,
            UUID enrollmentVersionId,
            ExamConfig config,
            Map<UUID, List<ExamAttempt>> attemptsByConfig
    ) {
        if (config == null) {
            return new StudentLearningProgressResponse.RequiredExamProgress(
                    slot, REQUIRED_EXAM_LABELS.get(slot), "not_configured",
                    null, null, null, null, null, null,
                    null, null, null, null);
        }

        List<ExamAttempt> attempts = attemptsByConfig.getOrDefault(config.getId(), List.of());
        ExamAttempt attempt = attempts.stream()
                .filter(item -> item.getSubmittedAt() != null && Boolean.TRUE.equals(item.getPassed()))
                .max(Comparator.comparing(ExamAttempt::getSubmittedAt))
                .orElseGet(() -> attempts.stream()
                        .max(Comparator.comparing(
                                item -> item.getSubmittedAt() != null
                                        ? item.getSubmittedAt()
                                        : item.getStartedAt(),
                                Comparator.nullsFirst(Comparator.naturalOrder())))
                        .orElse(null));
        boolean versionMatched = enrollmentVersionId == null
                || enrollmentVersionId.equals(config.getCourseVersionId());
        if (attempt == null) {
            return new StudentLearningProgressResponse.RequiredExamProgress(
                    slot, REQUIRED_EXAM_LABELS.get(slot), "not_submitted",
                    config.getId(), config.getCourseVersionId(), versionMatched,
                    null, null, null,
                    chapterId(config.getScopeStartChapter()), chapterTitle(config.getScopeStartChapter()),
                    chapterId(config.getPlacementChapter()), chapterTitle(config.getPlacementChapter()));
        }

        Double scorePercent = attempt.getEffectiveScorePercent() == null
                ? null
                : round1(attempt.getEffectiveScorePercent().doubleValue());
        String status;
        if (attempt.getSubmittedAt() == null) {
            status = "in_progress";
        } else if (attempt.getPassed() == null) {
            status = "pending_grading";
        } else {
            status = Boolean.TRUE.equals(attempt.getPassed()) ? "passed" : "failed";
        }
        return new StudentLearningProgressResponse.RequiredExamProgress(
                slot, REQUIRED_EXAM_LABELS.get(slot), status,
                config.getId(), config.getCourseVersionId(), versionMatched,
                scorePercent, attempt.getPassed(), attempt.getSubmittedAt(),
                chapterId(config.getScopeStartChapter()), chapterTitle(config.getScopeStartChapter()),
                chapterId(config.getPlacementChapter()), chapterTitle(config.getPlacementChapter()));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private StudentLearningProgressResponse.ChapterProgressDetail buildChapterProgressDetail(
            Chapter chapter,
            Map<UUID, CourseProgressItem> completedByItemId,
            QuizConfig quizConfig,
            Map<UUID, QuizAttempt> latestQuizByConfig
    ) {
        List<Lesson> lessons = chapter.getLessons().stream()
                .sorted(Comparator.comparing(Lesson::getPosition))
                .toList();
        List<StudentLearningProgressResponse.LessonProgressDetail> lessonDetails = lessons.stream()
                .map(lesson -> {
                    CourseProgressItem completed = completedByItemId.get(lesson.getId());
                    return new StudentLearningProgressResponse.LessonProgressDetail(
                            lesson.getId(),
                            lesson.getTitle(),
                            lesson.getPosition(),
                            lesson.getDurationSec(),
                            completed != null,
                            completed != null ? completed.getCompletedAt() : null);
                })
                .toList();
        QuizAttempt latestQuiz = quizConfig != null ? latestQuizByConfig.get(quizConfig.getId()) : null;
        boolean quizCompleted = quizConfig != null
                && (completedByItemId.containsKey(chapter.getId()) || latestQuiz != null);
        if (latestQuiz == null && quizCompleted) {
            latestQuiz = quizAttemptRepository
                    .findSubmittedByStudentAndChapter(
                            completedByItemId.get(chapter.getId()).getStudentId(),
                            chapter.getId())
                    .stream()
                    .findFirst()
                    .orElse(null);
        }

        int completedLessonCount = (int) lessonDetails.stream()
                .filter(StudentLearningProgressResponse.LessonProgressDetail::completed)
                .count();
        int progressDenominator = lessonDetails.size() + (quizConfig != null ? 1 : 0);
        int progressNumerator = completedLessonCount + (quizCompleted ? 1 : 0);
        int chapterProgressPct = progressDenominator == 0
                ? 0
                : (int) Math.round(progressNumerator * 100.0 / progressDenominator);
        return new StudentLearningProgressResponse.ChapterProgressDetail(
                chapter.getId(),
                chapter.getTitle(),
                chapter.getPosition(),
                completedLessonCount,
                lessonDetails.size(),
                quizConfig != null,
                quizCompleted,
                latestQuiz != null ? latestQuiz.getId() : null,
                latestQuiz != null && latestQuiz.getScore() != null ? latestQuiz.getScore().doubleValue() : null,
                latestQuiz != null ? latestQuiz.getPassed() : null,
                latestQuiz != null ? latestQuiz.getSubmittedAt() : null,
                lessonDetails,
                chapterProgressPct);
    }

    private StudentLearningProgressResponse.AssignmentProgress toAssignmentProgress(
            AssignmentSubmission submission) {
        Assignment assignment = submission.getAssignment();
        Chapter chapter = assignment != null && assignment.getChapter() != null
                ? assignment.getChapter()
                : assignment != null && assignment.getLesson() != null
                ? assignment.getLesson().getChapter()
                : null;
        Double score = submission.getScore() != null
                ? submission.getScore().doubleValue() : null;
        Double maxScore = assignment != null && assignment.getMaxScore() != null
                ? assignment.getMaxScore().doubleValue() : null;
        Double normalized = score != null && maxScore != null && maxScore > 0
                ? round1(Math.min(100.0, score * 100.0 / maxScore))
                : null;
        return new StudentLearningProgressResponse.AssignmentProgress(
                submission.getId(),
                assignment != null ? assignment.getId() : null,
                assignment != null ? assignment.getTitle() : "Bài tập",
                chapterId(chapter),
                chapterTitle(chapter),
                submission.getStatus(),
                score,
                maxScore,
                normalized,
                submission.isLate(),
                submission.getSubmittedAt(),
                submission.getGradedAt());
    }

    private UUID assignmentCourseId(AssignmentSubmission submission) {
        Assignment assignment = submission != null ? submission.getAssignment() : null;
        Course course = assignment != null ? assignment.getCourse() : null;
        return course != null ? course.getId() : null;
    }

    private UUID chapterId(Chapter chapter) {
        return chapter != null ? chapter.getId() : null;
    }

    private String chapterTitle(Chapter chapter) {
        return chapter != null ? chapter.getTitle() : null;
    }

    private long uniqueWatchedDurationSec(StudentVideoProgress progress) {
        if (progress == null) return 0L;
        String json = progress.getWatchedSegmentsJson();
        List<int[]> segments = new java.util.ArrayList<>();
        if (json != null) {
            Matcher matcher = WATCHED_SEGMENT_PATTERN.matcher(json);
            while (matcher.find()) {
                int start = Integer.parseInt(matcher.group(1));
                int end = Integer.parseInt(matcher.group(2));
                if (end > start) segments.add(new int[]{start, end});
            }
        }
        if (segments.isEmpty()) {
            int position = progress.getPositionSec() != null ? progress.getPositionSec() : 0;
            int duration = progress.getDurationSec() != null ? progress.getDurationSec() : position;
            return Math.max(0, Math.min(position, duration));
        }
        segments.sort(Comparator.comparingInt(segment -> segment[0]));
        long covered = 0;
        int start = segments.getFirst()[0];
        int end = segments.getFirst()[1];
        for (int index = 1; index < segments.size(); index++) {
            int[] segment = segments.get(index);
            if (segment[0] <= end) {
                end = Math.max(end, segment[1]);
            } else {
                covered += end - start;
                start = segment[0];
                end = segment[1];
            }
        }
        return covered + end - start;
    }

    private Double averageNullable(List<Double> values) {
        if (values == null || values.isEmpty()) return null;
        return round1(values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0));
    }

    private void requireEnrolled(UUID studentId, UUID courseId) {
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course", courseId);
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new BusinessException(
                    "COURSE_NOT_ENROLLED",
                    "Bạn cần ghi danh khóa học trước khi lưu tiến độ.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private void validateItemBelongsToCourse(
            UUID courseId, UUID itemId, String itemType, UUID studentId) {
        boolean valid = switch (itemType) {
            case ITEM_LESSON -> lessonRepository.existsByIdAndCourseId(itemId, courseId);
            case ITEM_QUIZ -> quizConfigRepository.existsByChapterIdAndCourseId(itemId, courseId);
            default -> false;
        };
        if (!valid) {
            throw new BusinessException(
                    "INVALID_PROGRESS_ITEM",
                    "Nội dung học không thuộc khóa học này.",
                    HttpStatus.BAD_REQUEST
            );
        }
        enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)
                .flatMap(enrollment -> courseVersionSnapshotService.findMetrics(
                        enrollment.getCourseVersionId()))
                .filter(metrics -> !metrics.containsProgressItem(itemId, itemType))
                .ifPresent(metrics -> {
                    throw new BusinessException(
                            "PROGRESS_ITEM_OUTSIDE_ENROLLMENT_VERSION",
                            "Nội dung không thuộc phiên bản khóa học của enrollment.",
                            HttpStatus.CONFLICT);
                });
    }

    private int calculateProgressPct(UUID studentId, UUID courseId) {
        Enrollment enrollment = enrollmentRepository.findByStudentIdAndCourseId(studentId, courseId)
                .orElse(null);
        long total = resolveProgressItemCount(
                enrollment, courseRepository.countProgressItemsByCourseId(courseId));
        if (total <= 0) return 0;
        long completed = Math.min(progressRepository.countByStudentIdAndCourseId(studentId, courseId), total);
        return (int) Math.round((completed * 100.0) / total);
    }

    private long resolveProgressItemCount(Enrollment enrollment, long fallback) {
        if (enrollment == null) return fallback;
        return courseVersionSnapshotService.findMetrics(enrollment.getCourseVersionId())
                .map(metrics -> metrics.quizSnapshotPresent()
                        ? (long) metrics.progressItemCount()
                        : (long) metrics.lessonIds().size()
                          + Math.max(0L, fallback - metrics.lessonIds().size()))
                .orElse(fallback);
    }

    private long resolveLessonCount(Enrollment enrollment, long fallback) {
        if (enrollment == null) return fallback;
        return courseVersionSnapshotService.findMetrics(enrollment.getCourseVersionId())
                .map(metrics -> (long) metrics.lessonIds().size())
                .orElse(fallback);
    }
}
