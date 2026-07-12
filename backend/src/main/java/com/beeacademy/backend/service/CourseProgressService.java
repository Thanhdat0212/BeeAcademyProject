package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CompleteCourseProgressItemRequest;
import com.beeacademy.backend.dto.response.CourseProgressResponse;
import com.beeacademy.backend.dto.response.StudentLearningProgressResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseProgressItem;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseProgressService {

    private static final String ITEM_LESSON = "lesson";
    private static final String ITEM_QUIZ = "quiz";
    private static final int FINAL_EXAM_SLOT_INDEX = 3;

    private final CourseProgressItemRepository progressRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final ChapterRepository chapterRepository;
    private final LessonRepository lessonRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final OrderItemRepository orderItemRepository;
    private final CertificateService certificateService;

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
                    0, 0, 0, 0, 0, 0, List.of());
        }

        List<UUID> courseIds = ownedCourseIds.stream().toList();
        List<Course> courses = courseRepository.findByIdIn(courseIds);
        Map<UUID, Integer> progressByCourse = calculateProgressForCourses(studentId, courseIds);
        java.util.Set<UUID> passedFinalCourseIds = new java.util.HashSet<>(
                examAttemptRepository.findPassedFinalCourseIds(studentId, courseIds, FINAL_EXAM_SLOT_INDEX));

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

        List<StudentLearningProgressResponse.CourseProgressDetail> courseDetails = courses.stream()
                .map(course -> buildCourseProgressDetail(
                        course,
                        enrollmentByCourse.get(course.getId()),
                        progressByCourse.getOrDefault(course.getId(), 0),
                        completedByItemId,
                        quizByChapter,
                        latestQuizByConfig,
                        passedFinalCourseIds.contains(course.getId())))
                .toList();

        int totalLessons = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::totalLessons).sum();
        int completedLessons = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::completedLessons).sum();
        int totalQuizzes = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::totalQuizzes).sum();
        int completedQuizzes = courseDetails.stream().mapToInt(StudentLearningProgressResponse.CourseProgressDetail::completedQuizzes).sum();
        int averageProgress = (int) Math.round(courseDetails.stream()
                .mapToInt(StudentLearningProgressResponse.CourseProgressDetail::progressPct)
                .average()
                .orElse(0.0));

        return new StudentLearningProgressResponse(
                courseDetails.size(),
                averageProgress,
                completedLessons,
                totalLessons,
                completedQuizzes,
                totalQuizzes,
                courseDetails);
    }

    @Transactional
    public CourseProgressResponse completeItem(
            UUID courseId,
            AuthenticatedUser me,
            CompleteCourseProgressItemRequest request
    ) {
        requireEnrolled(me.userId(), courseId);
        validateItemBelongsToCourse(courseId, request.itemId(), request.itemType());

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
        validateItemBelongsToCourse(courseId, lessonId, ITEM_LESSON);
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

    private CourseProgressResponse recordProgressItem(
            UUID courseId, AuthenticatedUser me, UUID itemId, String itemType) {

        boolean exists = progressRepository.existsByStudentIdAndCourseIdAndItemIdAndItemType(
                me.userId(), courseId, itemId, itemType
        );
        if (!exists) {
            progressRepository.save(CourseProgressItem.create(
                    me.userId(), courseId, itemId, itemType
            ));
        }

        int progressPct = calculateProgressPct(me.userId(), courseId);
        enrollmentRepository.findByStudentIdAndCourseId(me.userId(), courseId)
                .ifPresent(enrollment -> enrollment.updateProgress(progressPct));
        if (progressPct >= 100) {
            certificateService.tryIssueAfterProgress(me.userId(), courseId);
        }

        return buildResponse(me.userId(), courseId);
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

        return courseIds.stream().collect(Collectors.toMap(
                courseId -> courseId,
                courseId -> {
                    long total = Math.max(totalByCourse.getOrDefault(courseId, 0L), 0L);
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

        return courseIds.stream().collect(Collectors.toMap(
                courseId -> courseId,
                courseId -> {
                    long total = totalByCourse.getOrDefault(courseId, 0L);
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
            boolean finalExamPassed
    ) {
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(course.getId());
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
        return new StudentLearningProgressResponse.CourseProgressDetail(
                course.getId(),
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
                enrollment != null ? enrollment.getEnrolledAt() : null,
                chapterDetails);
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

        return new StudentLearningProgressResponse.ChapterProgressDetail(
                chapter.getId(),
                chapter.getTitle(),
                chapter.getPosition(),
                (int) lessonDetails.stream()
                        .filter(StudentLearningProgressResponse.LessonProgressDetail::completed)
                        .count(),
                lessonDetails.size(),
                quizConfig != null,
                quizCompleted,
                latestQuiz != null ? latestQuiz.getId() : null,
                latestQuiz != null && latestQuiz.getScore() != null ? latestQuiz.getScore().doubleValue() : null,
                latestQuiz != null ? latestQuiz.getPassed() : null,
                latestQuiz != null ? latestQuiz.getSubmittedAt() : null,
                lessonDetails);
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

    private void validateItemBelongsToCourse(UUID courseId, UUID itemId, String itemType) {
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
    }

    private int calculateProgressPct(UUID studentId, UUID courseId) {
        long total = courseRepository.countProgressItemsByCourseId(courseId);
        if (total <= 0) return 0;
        long completed = Math.min(progressRepository.countByStudentIdAndCourseId(studentId, courseId), total);
        return (int) Math.round((completed * 100.0) / total);
    }
}
