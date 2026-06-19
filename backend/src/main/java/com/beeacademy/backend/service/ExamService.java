package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamConfigRequest;
import com.beeacademy.backend.dto.request.ExamQuestionRandomRequest;
import com.beeacademy.backend.dto.request.GradeExamAttemptRequest;
import com.beeacademy.backend.dto.request.SubmitExamRequest;
import com.beeacademy.backend.dto.response.ExamConfigResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.dto.response.StudentExamResultResponse;
import com.beeacademy.backend.dto.response.StudentExamStartResponse;
import com.beeacademy.backend.dto.response.StudentExamSummaryResponse;
import com.beeacademy.backend.dto.response.TeacherExamAttemptResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamConfigRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CourseRepository courseRepository;
    private final ChapterRepository chapterRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final QuestionRepository questionRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ExamConfigResponse> listExams(UUID courseId, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        return examRepository.findByCourseIdOrderBySlotIndexAsc(courseId).stream()
                .map(config -> ExamConfigResponse.fromEntity(config, objectMapper))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamConfigResponse getExam(UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        return examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .map(config -> ExamConfigResponse.fromEntity(config, objectMapper))
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chưa có bài kiểm tra cho vị trí này.", HttpStatus.NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public QuestionStatsResponse getQuestionBankStats(UUID courseId, AuthenticatedUser me) {
        Course course = loadOwnedCourse(courseId, me.userId());
        List<Object[]> rows = questionRepository.countActiveByDifficultyForTeacherCategoryAndGrades(
                me.userId(), courseCategoryId(course), courseGrades(course));

        int easy = 0, medium = 0, hard = 0;
        for (Object[] row : rows) {
            String diff = (String) row[0];
            long count = (Long) row[1];
            switch (diff) {
                case "easy" -> easy = (int) count;
                case "medium" -> medium = (int) count;
                case "hard" -> hard = (int) count;
                default -> {
                }
            }
        }
        return new QuestionStatsResponse(easy, medium, hard, easy + medium + hard);
    }

    @Transactional(readOnly = true)
    public List<ExamConfigResponse.ExamQuestionResponse> randomQuestions(
            UUID courseId, AuthenticatedUser me, ExamQuestionRandomRequest req) {
        Course course = loadOwnedCourse(courseId, me.userId());
        validateRandomRequest(req);

        if (hasChapterConfigs(req)) {
            List<ExamConfigResponse.ExamQuestionResponse> result = new ArrayList<>();
            for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                    : req.chapterConfigs()) {
                Chapter chapter = loadCourseChapter(courseId, chapterReq.chapterId());
                List<Question> selected = pickRandomQuestionsByChapter(
                        me.userId(), chapter.getId(), chapterReq.totalCount());
                result.addAll(selected.stream()
                        .map(question -> toExamQuestion(question, req.pointsPerQuestion()))
                        .toList());
            }
            Collections.shuffle(result);
            return result;
        }

        UUID categoryId = courseCategoryId(course);
        List<Integer> grades = courseGrades(course);
        List<Question> selected = new ArrayList<>();
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "easy", req.easyCount()));
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "medium", req.mediumCount()));
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "hard", req.hardCount()));
        Collections.shuffle(selected);

        return selected.stream()
                .map(question -> toExamQuestion(question, req.pointsPerQuestion()))
                .toList();
    }

    @Transactional
    public ExamConfigResponse saveExam(UUID courseId, Integer slotIndex,
                                       AuthenticatedUser me, ExamConfigRequest req) {
        Course course = loadOwnedCourse(courseId, me.userId());
        Profile teacher = loadProfile(me.userId());
        validateSlot(courseId, slotIndex);
        validateRequest(req);

        String questionsJson = toJson(req.questions());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElse(null);

        if (config == null) {
            config = ExamConfig.create(course, teacher, slotIndex,
                    req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    questionsJson);
        } else {
            config.update(req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    questionsJson);
        }

        ExamConfig saved = examRepository.save(config);
        log.info("Teacher {} saved exam course={} slot={}", me.userId(), courseId, slotIndex);
        return ExamConfigResponse.fromEntity(saved, objectMapper);
    }

    @Transactional
    public void deleteExam(UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chưa có bài kiểm tra cho vị trí này.", HttpStatus.NOT_FOUND));
        examRepository.delete(config);
    }

    @Transactional(readOnly = true)
    public List<StudentExamSummaryResponse> listStudentExams(UUID courseId, AuthenticatedUser me) {
        verifyEnrollment(courseId, me.userId());
        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        Map<Integer, ExamConfig> examsBySlot = new HashMap<>();
        examRepository.findByCourseIdOrderBySlotIndexAsc(courseId)
                .forEach(exam -> examsBySlot.put(exam.getSlotIndex(), exam));

        int slotCount = chapters.size() / 3;
        List<StudentExamSummaryResponse> result = new ArrayList<>();
        for (int slot = 0; slot < slotCount; slot++) {
            List<Chapter> requiredChapters = chapters.subList(slot * 3, slot * 3 + 3);
            result.add(buildStudentExamSummary(
                    examsBySlot.get(slot), slot, requiredChapters, me.userId()));
        }
        return result;
    }

    @Transactional
    public StudentExamStartResponse startStudentExam(UUID courseId, Integer slotIndex,
                                                     AuthenticatedUser me) {
        verifyEnrollment(courseId, me.userId());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Giáo viên chưa cấu hình bài kiểm tra này.", HttpStatus.NOT_FOUND));
        assertStudentExamUnlocked(courseId, slotIndex, me.userId());

        int attemptCount = examAttemptRepository.countByStudentIdAndExamConfigId(
                me.userId(), config.getId());
        if (attemptCount >= config.getMaxAttempts()) {
            throw new BusinessException("MAX_ATTEMPTS_REACHED",
                    "Bạn đã hết lượt làm bài kiểm tra này.");
        }

        List<ExamConfigResponse.ExamQuestionResponse> questions = parseExamQuestions(config);
        if (Boolean.TRUE.equals(config.getShuffleQuestions())) {
            Collections.shuffle(questions);
        }
        List<SnapshotExamQuestion> snapshot = questions.stream()
                .map(q -> toSnapshotQuestion(q, Boolean.TRUE.equals(config.getShuffleOptions())))
                .toList();

        Profile student = loadProfile(me.userId());
        ExamAttempt attempt = ExamAttempt.start(student, config, toJson(snapshot), attemptCount + 1);
        ExamAttempt saved = examAttemptRepository.save(attempt);

        return new StudentExamStartResponse(
                saved.getId(),
                config.getId(),
                config.getSlotIndex(),
                config.getName(),
                config.getDescription(),
                config.getDurationMinutes(),
                snapshot.size(),
                saved.getAttemptNumber(),
                snapshot.stream()
                        .map(q -> new StudentExamStartResponse.QuestionForStudent(
                                q.id(), q.text(), q.type(), q.options(), q.points()))
                        .toList()
        );
    }

    @Transactional
    public StudentExamResultResponse submitStudentExam(UUID attemptId, AuthenticatedUser me,
                                                       SubmitExamRequest req) {
        ExamAttempt attempt = examAttemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", attemptId));
        if (attempt.getSubmittedAt() != null) {
            throw new BusinessException("ALREADY_SUBMITTED",
                    "Bài kiểm tra này đã được nộp rồi.");
        }

        List<SnapshotExamQuestion> questions = readSnapshotQuestions(attempt.getQuestionsSnapshot());
        Map<String, List<Integer>> answers = req.answers() != null ? req.answers() : Map.of();
        double earned = 0.0;
        double total = questions.stream()
                .map(SnapshotExamQuestion::points)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
        List<StudentExamResultResponse.QuestionResult> details = new ArrayList<>();

        for (SnapshotExamQuestion question : questions) {
            List<Integer> studentAnswers = normalizeAnswer(answers.get(question.id()));
            List<Integer> correctAnswers = normalizeAnswer(question.correctIndices());
            boolean correct = studentAnswers.equals(correctAnswers);
            if (correct) {
                earned += question.points() != null ? question.points() : 0.0;
            }
            boolean showAnswer = Boolean.TRUE.equals(attempt.getExamConfig().getShowAnswerAfterSubmit());
            details.add(new StudentExamResultResponse.QuestionResult(
                    question.id(),
                    question.text(),
                    studentAnswers,
                    showAnswer ? correctAnswers : List.of(),
                    correct,
                    showAnswer ? question.explanation() : null,
                    question.points()
            ));
        }

        double scorePercent = total > 0 ? Math.round((earned / total) * 1000.0) / 10.0 : 0.0;
        boolean passed = scorePercent >= attempt.getExamConfig().getPassScorePercent();
        attempt.submit(toJson(answers), scorePercent, passed);
        examAttemptRepository.save(attempt);

        return new StudentExamResultResponse(
                attempt.getId(),
                attempt.getExamConfig().getId(),
                attempt.getExamConfig().getSlotIndex(),
                scorePercent,
                passed,
                Math.round(earned * 10.0) / 10.0,
                Math.round(total * 10.0) / 10.0,
                attempt.getAttemptNumber(),
                details
        );
    }

    @Transactional(readOnly = true)
    public List<TeacherExamAttemptResponse> listTeacherExamAttempts(AuthenticatedUser me) {
        return examAttemptRepository.findSubmittedAttemptsForTeacher(me.userId()).stream()
                .map(this::toTeacherExamAttemptResponse)
                .toList();
    }

    @Transactional
    public TeacherExamAttemptResponse gradeExamAttempt(
            UUID attemptId,
            AuthenticatedUser me,
            GradeExamAttemptRequest request) {
        ExamAttempt attempt = examAttemptRepository
                .findSubmittedAttemptForTeacher(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", attemptId));

        attempt.grade(request.scorePercent(), request.feedback());
        ExamAttempt saved = examAttemptRepository.save(attempt);
        log.info("Teacher {} graded exam attempt {} with score={}",
                me.userId(), attemptId, request.scorePercent());
        return toTeacherExamAttemptResponse(saved);
    }

    private TeacherExamAttemptResponse toTeacherExamAttemptResponse(ExamAttempt attempt) {
        List<SnapshotExamQuestion> questions = readSnapshotQuestions(attempt.getQuestionsSnapshot());
        Map<String, List<Integer>> answers = readAnswers(attempt.getAnswers());
        List<TeacherExamAttemptResponse.QuestionReview> reviews = questions.stream()
                .map(question -> {
                    List<Integer> studentAnswers = normalizeAnswer(answers.get(question.id()));
                    List<Integer> correctAnswers = normalizeAnswer(question.correctIndices());
                    boolean correct = studentAnswers.equals(correctAnswers);
                    double points = question.points() != null ? question.points() : 0.0;
                    return new TeacherExamAttemptResponse.QuestionReview(
                            question.id(),
                            question.text(),
                            question.type(),
                            question.options(),
                            studentAnswers,
                            correctAnswers,
                            correct,
                            points,
                            correct ? points : 0.0,
                            question.explanation());
                })
                .toList();

        Double autoScore = attempt.getScorePercent() != null
                ? attempt.getScorePercent().doubleValue()
                : null;
        Double manualScore = attempt.getManualScorePercent() != null
                ? attempt.getManualScorePercent().doubleValue()
                : null;
        Double effectiveScore = attempt.getEffectiveScorePercent() != null
                ? attempt.getEffectiveScorePercent().doubleValue()
                : null;

        return new TeacherExamAttemptResponse(
                attempt.getId(),
                attempt.getStudent().getId(),
                attempt.getStudent().getFullName(),
                attempt.getExamConfig().getCourse().getId(),
                attempt.getExamConfig().getCourse().getTitle(),
                attempt.getExamConfig().getId(),
                attempt.getExamConfig().getName(),
                attempt.getExamConfig().getSlotIndex(),
                attempt.getAttemptNumber(),
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                autoScore,
                manualScore,
                effectiveScore,
                attempt.getExamConfig().getPassScorePercent(),
                attempt.getPassed(),
                attempt.getTeacherFeedback(),
                attempt.getGradedAt(),
                attempt.getGradedAt() == null ? "pending" : "graded",
                reviews);
    }

    private Map<String, List<Integer>> readAnswers(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(
                    json,
                    new TypeReference<Map<String, List<Integer>>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR",
                    "Không thể đọc đáp án bài kiểm tra.");
        }
    }

    private StudentExamSummaryResponse buildStudentExamSummary(
            ExamConfig config, int slotIndex, List<Chapter> requiredChapters, UUID studentId) {
        Map<UUID, QuizConfig> quizByChapter = new HashMap<>();
        quizConfigRepository.findByChapterIdIn(
                requiredChapters.stream().map(Chapter::getId).toList())
                .forEach(quiz -> quizByChapter.put(quiz.getChapter().getId(), quiz));

        int passedQuizCount = 0;
        List<StudentExamSummaryResponse.RequiredChapter> chapterDtos = new ArrayList<>();
        for (Chapter chapter : requiredChapters) {
            QuizConfig quiz = quizByChapter.get(chapter.getId());
            boolean hasQuiz = quiz != null;
            boolean quizPassed = hasQuiz && quizAttemptRepository
                    .existsByStudentIdAndQuizConfigIdAndPassedTrue(studentId, quiz.getId());
            if (quizPassed) passedQuizCount++;
            chapterDtos.add(new StudentExamSummaryResponse.RequiredChapter(
                    chapter.getId(), chapter.getTitle(), hasQuiz, quizPassed));
        }

        boolean configured = config != null;
        int attemptsUsed = configured
                ? examAttemptRepository.countByStudentIdAndExamConfigId(studentId, config.getId())
                : 0;
        ExamAttempt latestAttempt = configured
                ? examAttemptRepository
                        .findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(
                                studentId, config.getId())
                        .orElse(null)
                : null;
        boolean passed = latestAttempt != null && Boolean.TRUE.equals(latestAttempt.getPassed());
        boolean prerequisitesMet = passedQuizCount == requiredChapters.size()
                && chapterDtos.stream().allMatch(StudentExamSummaryResponse.RequiredChapter::hasQuiz);
        boolean attemptsAvailable = configured && attemptsUsed < config.getMaxAttempts();
        boolean unlocked = configured && prerequisitesMet && (attemptsAvailable || passed);
        String lockedReason = null;
        if (!configured) {
            lockedReason = "Giáo viên chưa cấu hình bài kiểm tra.";
        } else if (!prerequisitesMet) {
            lockedReason = "Cần pass đủ 3 quiz chương liên tiếp để mở khóa.";
        } else if (!attemptsAvailable && !passed) {
            lockedReason = "Bạn đã hết lượt làm bài kiểm tra này.";
        }

        return new StudentExamSummaryResponse(
                configured ? config.getId() : null,
                slotIndex,
                configured ? config.getName() : "Bài kiểm tra sau chương " + (slotIndex * 3 + 1) + "-" + (slotIndex * 3 + 3),
                configured ? config.getDescription() : null,
                configured ? config.getDurationMinutes() : null,
                configured ? config.getPassScorePercent() : null,
                configured ? config.getMaxAttempts() : null,
                configured,
                unlocked,
                passed,
                latestAttempt != null && latestAttempt.getEffectiveScorePercent() != null
                        ? latestAttempt.getEffectiveScorePercent().doubleValue()
                        : null,
                attemptsUsed,
                requiredChapters.size(),
                passedQuizCount,
                lockedReason,
                chapterDtos
        );
    }

    private void assertStudentExamUnlocked(UUID courseId, int slotIndex, UUID studentId) {
        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        int from = slotIndex * 3;
        if (slotIndex < 0 || from + 3 > chapters.size()) {
            throw new BusinessException("INVALID_SLOT",
                    "Vị trí bài kiểm tra không hợp lệ.", HttpStatus.BAD_REQUEST);
        }
        StudentExamSummaryResponse summary = buildStudentExamSummary(
                examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex).orElse(null),
                slotIndex,
                chapters.subList(from, from + 3),
                studentId);
        if (!Boolean.TRUE.equals(summary.unlocked())) {
            throw new BusinessException("EXAM_LOCKED",
                    summary.lockedReason() != null ? summary.lockedReason() : "Bài kiểm tra đang bị khóa.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void verifyEnrollment(UUID courseId, UUID studentId) {
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new BusinessException("NOT_ENROLLED",
                    "Bạn chưa mua khóa học này.", HttpStatus.FORBIDDEN);
        }
    }

    private List<ExamConfigResponse.ExamQuestionResponse> parseExamQuestions(ExamConfig config) {
        try {
            return new ArrayList<>(objectMapper.readValue(
                    config.getQuestionsJson(),
                    new TypeReference<List<ExamConfigResponse.ExamQuestionResponse>>() {}));
        } catch (Exception e) {
            throw new BusinessException("INVALID_EXAM",
                    "Không thể đọc danh sách câu hỏi bài kiểm tra.");
        }
    }

    private SnapshotExamQuestion toSnapshotQuestion(
            ExamConfigResponse.ExamQuestionResponse question, boolean shuffleOptions) {
        List<OptionWithOriginalIndex> options = IntStream.range(0, question.options().size())
                .mapToObj(i -> new OptionWithOriginalIndex(question.options().get(i), i))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        if (shuffleOptions) {
            Collections.shuffle(options);
        }
        List<String> optionTexts = options.stream()
                .map(OptionWithOriginalIndex::text)
                .toList();
        List<Integer> correctIndices = IntStream.range(0, options.size())
                .filter(i -> question.correctIndices().contains(options.get(i).originalIndex()))
                .boxed()
                .toList();
        return new SnapshotExamQuestion(
                question.id(),
                question.text(),
                question.type(),
                optionTexts,
                correctIndices,
                question.explanation(),
                question.points() != null ? question.points() : 0.0
        );
    }

    private List<SnapshotExamQuestion> readSnapshotQuestions(String json) {
        try {
            return objectMapper.readValue(
                    json,
                    new TypeReference<List<SnapshotExamQuestion>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR",
                    "Không thể đọc bài kiểm tra.");
        }
    }

    private List<Integer> normalizeAnswer(List<Integer> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    private record OptionWithOriginalIndex(String text, Integer originalIndex) {}

    private record SnapshotExamQuestion(
            String id,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            String explanation,
            Double points
    ) {}

    private Course loadOwnedCourse(UUID courseId, UUID teacherId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (course.getTeacher() == null || !course.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền quản lý bài kiểm tra của khóa học này.",
                    HttpStatus.FORBIDDEN);
        }
        return course;
    }

    private Profile loadProfile(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", profileId));
    }

    private void validateSlot(UUID courseId, Integer slotIndex) {
        if (slotIndex == null || slotIndex < 0) {
            throw new BusinessException("INVALID_SLOT", "Vị trí bài kiểm tra không hợp lệ.");
        }
        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        int slotCount = chapters.size() / 3;
        if (slotIndex >= slotCount) {
            throw new BusinessException("INVALID_SLOT",
                    "Khóa học cần đủ 3 chương cho mỗi bài kiểm tra.");
        }
    }

    private void validateRequest(ExamConfigRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu bài kiểm tra không hợp lệ.");
        }
        if (req.questions() == null || req.questions().isEmpty()) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Bài kiểm tra phải có ít nhất 1 câu hỏi.");
        }
        for (int i = 0; i < req.questions().size(); i++) {
            ExamConfigRequest.ExamQuestionRequest q = req.questions().get(i);
            if (q == null || q.options() == null || q.correctIndices() == null) {
                throw new BusinessException("INVALID_QUESTIONS",
                        "Câu " + (i + 1) + " không hợp lệ.");
            }
            if ("single".equals(q.type()) && q.correctIndices().size() != 1) {
                throw new BusinessException("INVALID_QUESTIONS",
                        "Câu " + (i + 1) + " dạng một đáp án phải có đúng 1 đáp án đúng.");
            }
            int optionCount = q.options().size();
            for (Integer correctIndex : q.correctIndices()) {
                if (correctIndex == null || correctIndex < 0 || correctIndex >= optionCount) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Câu " + (i + 1) + " có đáp án đúng không hợp lệ.");
                }
            }
        }
    }

    private void validateRandomRequest(ExamQuestionRandomRequest req) {
        if (req != null && hasChapterConfigs(req)) {
            validateChapterRandomRequest(req);
            return;
        }
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu random câu hỏi không hợp lệ.");
        }
        if (req.easyCount() == null || req.mediumCount() == null
                || req.hardCount() == null || req.pointsPerQuestion() == null) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Phân bổ câu hỏi random không hợp lệ.");
        }
        int total = req.easyCount() + req.mediumCount() + req.hardCount();
        if (total <= 0) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Cần chọn ít nhất 1 câu hỏi để random.");
        }
        if (total > 200) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Mỗi lần random tối đa 200 câu hỏi.");
        }
    }

    private void validateChapterRandomRequest(ExamQuestionRandomRequest req) {
        if (req.pointsPerQuestion() == null) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Phân bổ câu hỏi random không hợp lệ.");
        }
        int total = 0;
        for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                : req.chapterConfigs()) {
            if (chapterReq.chapterId() == null
                    || chapterReq.totalCount() == null) {
                throw new BusinessException("INVALID_RANDOM_CONFIG",
                        "Phân bổ câu hỏi theo chương không hợp lệ.");
            }
            total += chapterReq.totalCount();
        }
        if (total <= 0) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Cần chọn ít nhất 1 câu hỏi để random.");
        }
        if (total > 200) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Mỗi lần random tối đa 200 câu hỏi.");
        }
    }

    private boolean hasChapterConfigs(ExamQuestionRandomRequest req) {
        return req.chapterConfigs() != null && !req.chapterConfigs().isEmpty();
    }

    private List<Question> pickRandomQuestions(UUID teacherId, UUID categoryId, List<Integer> grades,
                                               String difficulty, int count) {
        if (count <= 0) {
            return List.of();
        }
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByTeacherAndCategoryAndGradesAndDifficulty(
                        teacherId, categoryId, grades, difficulty));
        if (pool.size() < count) {
            throw new BusinessException("QUESTION_BANK_NOT_ENOUGH",
                    "Ngân hàng câu hỏi chưa đủ câu " + difficulty
                            + ": cần " + count + ", hiện có " + pool.size() + ".");
        }
        Collections.shuffle(pool);
        return pool.subList(0, count);
    }

    private List<Question> pickRandomQuestionsByChapter(UUID teacherId, UUID chapterId,
                                                        int count) {
        if (count <= 0) {
            return List.of();
        }
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByTeacherAndChapter(teacherId, chapterId));
        if (pool.size() < count) {
            throw new BusinessException("QUESTION_BANK_NOT_ENOUGH",
                    "Ngân hàng câu hỏi chưa đủ cho chương này: cần " + count
                            + ", hiện có " + pool.size() + ".");
        }
        Collections.shuffle(pool);
        return pool.subList(0, count);
    }

    private Chapter loadCourseChapter(UUID courseId, UUID chapterId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
        if (chapter.getCourse() == null || !chapter.getCourse().getId().equals(courseId)) {
            throw new BusinessException("INVALID_CHAPTER",
                    "Chương không thuộc khóa học đang chọn.");
        }
        return chapter;
    }

    private ExamConfigResponse.ExamQuestionResponse toExamQuestion(Question question,
                                                                   Double pointsPerQuestion) {
        List<QuestionChoice> choices = new ArrayList<>(question.getChoices());
        choices.sort(Comparator.comparing(QuestionChoice::getPosition));
        List<String> options = choices.stream()
                .map(QuestionChoice::getContent)
                .toList();
        List<Integer> correctIndices = IntStream.range(0, choices.size())
                .filter(i -> Boolean.TRUE.equals(choices.get(i).getIsCorrect()))
                .boxed()
                .toList();
        String examQuestionType = correctIndices.size() > 1 ? "multiple" : "single";
        return new ExamConfigResponse.ExamQuestionResponse(
                question.getId().toString(),
                question.getContent(),
                examQuestionType,
                options,
                correctIndices,
                question.getExplanation(),
                pointsPerQuestion,
                question.getDifficulty()
        );
    }

    private UUID courseCategoryId(Course course) {
        if (course.getCategory() == null) {
            throw new BusinessException("COURSE_CATEGORY_MISSING",
                    "Khóa học chưa có thông tin môn học.");
        }
        return course.getCategory().getId();
    }

    private List<Integer> courseGrades(Course course) {
        int[] grades = course.getGrades();
        if (grades == null || grades.length == 0) {
            throw new BusinessException("COURSE_GRADE_MISSING",
                    "Khóa học chưa có thông tin lớp.");
        }
        return Arrays.stream(grades).boxed().toList();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Không thể lưu danh sách câu hỏi.");
        }
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
