package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamConfigRequest;
import com.beeacademy.backend.dto.request.ExamAiDraftRequest;
import com.beeacademy.backend.dto.request.ExamAiReviewRequest;
import com.beeacademy.backend.dto.request.ExamQuestionRandomRequest;
import com.beeacademy.backend.dto.request.GradeExamAttemptRequest;
import com.beeacademy.backend.dto.request.SaveExamDraftRequest;
import com.beeacademy.backend.dto.request.SubmitExamRequest;
import com.beeacademy.backend.dto.response.ExamAiDraftResponse;
import com.beeacademy.backend.dto.response.ExamConfigResponse;
import com.beeacademy.backend.dto.response.QuestionResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.dto.response.StudentExamResponse;
import com.beeacademy.backend.dto.response.StudentExamSubmissionResponse;
import com.beeacademy.backend.dto.response.TeacherExamAttemptResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamAiAuditLog;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.model.RewardAssessmentType;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAiAuditLogRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.client.SupabaseStorageClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private static final int FIXED_EXAM_SLOT_COUNT = 4;
    private static final int FINAL_EXAM_SLOT_INDEX = 3;
    private static final double EXAM_TOTAL_POINTS = 10.0;
    private static final long RETAKE_WINDOW_DAYS = 14L;
    private static final String ITEM_LESSON = "lesson";
    private static final String EXAM_TYPE_QUIZ = "quiz";
    private static final String EXAM_TYPE_CHAPTER_TEST = "chapter_test";
    private static final String EXAM_TYPE_FINAL_EXAM = "final_exam";
    private static final String AI_STATUS_APPROVED = "approved";
    private static final String AI_ACTION_GENERATED_DRAFT = "GENERATED_DRAFT";
    private static final String AI_ACTION_APPROVED = "APPROVED_AI_QUESTION";
    private static final String AI_ACTION_REJECTED = "REJECTED_AI_QUESTION";
    private static final String EXAM_ANSWER_IMAGE_BUCKET = "course-docs";
    private static final long MAX_EXAM_ANSWER_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXAM_ANSWER_IMAGE_MIME = Set.of(
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain");
    private static final Set<String> OBJECTIVE_EXAM_TYPES = Set.of(
            "multiple_choice", "true_false", "image_question", "formula_question", "audio_question");
    private static final Set<String> TEXT_ANSWER_EXAM_TYPES = Set.of("fill_in_blank", "matching");
    private static final Set<String> MANUAL_EXAM_TYPES = Set.of(
            "essay", "essay_short", "essay_long", "file_upload");
    private static final List<String> RANDOM_SUPPORTED_OBJECTIVE_TYPES = List.of(
            "multiple_choice", "true_false", "fill_in_blank");
    private static final List<String> RANDOM_SUPPORTED_ESSAY_TYPES = List.of(
            "essay", "essay_short", "essay_long");
    private final ExamConfigRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseProgressItemRepository progressItemRepository;
    private final ChapterRepository chapterRepository;
    private final ProfileRepository profileRepository;
    private final QuestionRepository questionRepository;
    private final ExamAiAuditLogRepository examAiAuditLogRepository;
    private final ObjectMapper objectMapper;
    private final SupabaseStorageClient storageClient;
    private final AiScanService aiScanService;
    private final UserNotificationService userNotificationService;
    private final RewardService rewardService;
    private final CertificateService certificateService;
    private final ExamRetakeService examRetakeService;

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
    public List<StudentExamResponse> listStudentExams(UUID courseId, AuthenticatedUser me) {
        requireStudentEnrollment(courseId, me.userId());
        return examRepository.findStudentVisibleByCourseId(courseId).stream()
                .filter(config -> isFixedExamSlot(config.getSlotIndex()))
                .filter(config -> isExamUnlockedForStudent(config, me.userId()))
                .map(config -> StudentExamResponse.fromEntity(config, objectMapper, me.userId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public StudentExamResponse getStudentExam(UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        validateSlot(slotIndex);
        requireStudentEnrollment(courseId, me.userId());
        return examRepository.findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .filter(config -> isExamUnlockedForStudent(config, me.userId()))
                .map(config -> StudentExamResponse.fromEntity(config, objectMapper, me.userId()))
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Bai kiem tra chua duoc mo. Hay hoan thanh 100% noi dung trong pham vi.",
                        HttpStatus.FORBIDDEN));
    }

    @Transactional
    public StudentExamSubmissionResponse submitStudentExam(
            UUID courseId,
            Integer slotIndex,
            AuthenticatedUser me,
            SubmitExamRequest request) {
        validateSlot(slotIndex);
        requireStudentEnrollment(courseId, me.userId());
        if (request == null || request.answers() == null) {
            throw new BusinessException("INVALID_SUBMISSION",
                    "Thieu danh sach cau tra loi.");
        }
        validateAnswerImages(me.userId(), request.answers());

        ExamConfig config = examRepository.findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chua co bai kiem tra cho vi tri nay.", HttpStatus.NOT_FOUND));
        requireExamUnlockedForStudent(config, me.userId());

        int submittedCount = enforceStudentAttemptWindow(me.userId(), config);

        List<SnapshotExamQuestion> questions = readSnapshotQuestions(config.getQuestionsJson());
        ExamScoringSummary scoringSummary = scoreObjectiveQuestions(questions, request.answers());
        Boolean passed = scoringSummary.hasEssay()
                ? null
                : scoringSummary.autoScorePercent() >= effectivePassScorePercent(config);

        Profile student = loadProfile(me.userId());
        ExamAttempt attempt = examAttemptRepository
                .findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNullOrderByStartedAtDesc(
                        me.userId(), config.getId())
                .orElseGet(() -> ExamAttempt.start(
                        student,
                        config,
                        config.getQuestionsJson(),
                        submittedCount + 1));
        attempt.submit(toJson(request.answers()), scoringSummary.autoScorePercent(), passed);
        ExamAttempt saved = examAttemptRepository.save(attempt);

        if (scoringSummary.hasEssay()) {
            try {
                notifyTeacherAboutEssaySubmission(config, student, saved);
            } catch (Exception ex) {
                log.warn("Could not notify teacher about essay exam attempt {}", saved.getId(), ex);
            }
        } else {
            rewardService.recordAssessmentScore(
                    me.userId(),
                    RewardAssessmentType.EXAM,
                    config.getId(),
                    scoringSummary.autoScorePercent());
            certificateService.tryIssueAfterProgress(me.userId(), courseId);
        }

        log.info("Student {} submitted exam course={} slot={} attempt={} autoScore={}",
                me.userId(), courseId, slotIndex, saved.getId(), scoringSummary.autoScorePercent());

        return new StudentExamSubmissionResponse(
                saved.getId(),
                config.getId(),
                config.getName(),
                config.getSlotIndex(),
                saved.getAttemptNumber(),
                scoringSummary.autoScorePercent(),
                saved.getPassed(),
                scoringSummary.hasEssay() ? "pending" : "graded",
                scoringSummary.correctObjectiveCount(),
                scoringSummary.totalObjectiveCount(),
                saved.getSubmittedAt(),
                null,
                scoringSummary.hasEssay() ? null : scoringSummary.autoScorePercent(),
                null,
                null);
    }

    /** Lấy kết quả lần làm bài gần nhất đã nộp — cho học sinh xem lại sau khi rời trang thi,
        kể cả sau khi giáo viên đã chấm phần tự luận. Không chặn học sinh làm lại nếu còn lượt. */
    @Transactional(readOnly = true)
    public StudentExamSubmissionResponse getStudentExamResult(
            UUID courseId,
            Integer slotIndex,
            AuthenticatedUser me) {
        validateSlot(slotIndex);
        requireStudentEnrollment(courseId, me.userId());

        ExamConfig config = examRepository.findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElse(null);
        if (config == null) {
            return null;
        }

        ExamAttempt attempt = examAttemptRepository
                .findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(
                        me.userId(), config.getId())
                .orElse(null);
        if (attempt == null) {
            return null;
        }

        List<SnapshotExamQuestion> questions = readSnapshotQuestions(attempt.getQuestionsSnapshot());
        Map<String, SubmitExamRequest.ExamAnswerRequest> answers = readAnswers(attempt.getAnswers());
        ExamScoringSummary scoringSummary = scoreObjectiveQuestions(questions, answers);

        String status = attempt.getGradedAt() != null || !scoringSummary.hasEssay()
                ? "graded"
                : "pending";

        return new StudentExamSubmissionResponse(
                attempt.getId(),
                config.getId(),
                config.getName(),
                config.getSlotIndex(),
                attempt.getAttemptNumber(),
                attempt.getScorePercent() != null ? attempt.getScorePercent().doubleValue() : null,
                attempt.getPassed(),
                status,
                scoringSummary.correctObjectiveCount(),
                scoringSummary.totalObjectiveCount(),
                attempt.getSubmittedAt(),
                attempt.getManualScorePercent() != null ? attempt.getManualScorePercent().doubleValue() : null,
                attempt.getEffectiveScorePercent() != null ? attempt.getEffectiveScorePercent().doubleValue() : null,
                attempt.getTeacherFeedback(),
                attempt.getGradedAt());
    }

    @Transactional
    public void saveStudentExamDraft(
            UUID courseId,
            Integer slotIndex,
            AuthenticatedUser me,
            SaveExamDraftRequest request) {
        validateSlot(slotIndex);
        requireStudentEnrollment(courseId, me.userId());
        if (request == null || request.answers() == null) {
            throw new BusinessException("INVALID_DRAFT", "Thieu danh sach cau tra loi.");
        }
        validateAnswerImages(me.userId(), request.answers());

        ExamConfig config = examRepository.findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chua co bai kiem tra cho vi tri nay.", HttpStatus.NOT_FOUND));
        requireExamUnlockedForStudent(config, me.userId());

        int submittedCount = enforceStudentAttemptWindow(me.userId(), config);
        Profile student = loadProfile(me.userId());
        ExamAttempt attempt = examAttemptRepository
                .findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNullOrderByStartedAtDesc(
                        me.userId(), config.getId())
                .orElseGet(() -> ExamAttempt.start(
                        student,
                        config,
                        config.getQuestionsJson(),
                        submittedCount + 1));
        attempt.saveDraft(toJson(request.answers()));
        examAttemptRepository.save(attempt);
    }

    private void notifyTeacherAboutEssaySubmission(
            ExamConfig config,
            Profile student,
            ExamAttempt attempt) {
        if (config.getCourse() == null || config.getCourse().getTeacher() == null) {
            return;
        }
        String studentName = student.getFullName() == null || student.getFullName().isBlank()
                ? "Hoc sinh"
                : student.getFullName().trim();
        userNotificationService.notify(
                config.getCourse().getTeacher().getId(),
                "exam_essay_submission",
                "Co bai tu luan moi can cham",
                "%s vua nop bai kiem tra \"%s\" va co phan tu luan can giao vien cham."
                        .formatted(studentName, config.getName()),
                "/teacher/grades"
        );
        log.info("Notified teacher {} about essay exam attempt {}",
                config.getCourse().getTeacher().getId(), attempt.getId());
    }

    public UploadResponse uploadStudentExamAnswerImage(
            UUID courseId,
            AuthenticatedUser me,
            MultipartFile file) {
        requireStudentEnrollment(courseId, me.userId());
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui long chon anh.");
        }
        if (file.getSize() > MAX_EXAM_ANSWER_IMAGE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "Anh dap an toi da 5 MB.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_EXAM_ANSWER_IMAGE_MIME.contains(contentType)) {
            throw new BusinessException("UNSUPPORTED_FILE_TYPE",
                    "Chi ho tro PNG, JPG, WEBP, PDF, DOC, DOCX hoac TXT.", HttpStatus.BAD_REQUEST);
        }

        String extension = switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "application/pdf" -> ".pdf";
            case "application/msword" -> ".doc";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx";
            case "text/plain" -> ".txt";
            default -> ".jpg";
        };
        String path = "exam-answer-images/" + me.userId() + "/" + UUID.randomUUID() + extension;
        String publicUrl = storageClient.upload(EXAM_ANSWER_IMAGE_BUCKET, path, contentType,
                file.getResource(), file.getSize());
        return new UploadResponse(path, publicUrl, contentType, file.getSize());
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
            List<Question> selectedQuestions = new ArrayList<>();
            for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                    : req.chapterConfigs()) {
                Chapter chapter = loadCourseChapter(courseId, chapterReq.chapterId());
                List<Question> selected = pickRandomQuestionsByChapter(
                        me.userId(), chapter.getId(), chapterReq);
                selectedQuestions.addAll(selected);
            }
            Collections.shuffle(selectedQuestions);
            int objectiveTotal = (int) selectedQuestions.stream()
                    .filter(question -> OBJECTIVE_EXAM_TYPES.contains(question.getType())
                            || TEXT_ANSWER_EXAM_TYPES.contains(question.getType()))
                    .count();
            int essayTotal = (int) selectedQuestions.stream()
                    .filter(question -> MANUAL_EXAM_TYPES.contains(question.getType()))
                    .count();
            double objectivePoint = objectiveTotal > 0
                    ? req.objectivePoints() / objectiveTotal
                    : 0.0;
            double essayPoint = essayTotal > 0
                    ? req.essayPoints() / essayTotal
                    : 0.0;
            result.addAll(selectedQuestions.stream()
                    .map(question -> toExamQuestion(question,
                            MANUAL_EXAM_TYPES.contains(question.getType()) ? essayPoint : objectivePoint))
                    .toList());
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
    public ExamAiDraftResponse generateAiDraft(UUID courseId, AuthenticatedUser me,
                                               ExamAiDraftRequest req) {
        loadOwnedCourse(courseId, me.userId());
        if (req.chapterId() != null) {
            loadCourseChapter(courseId, req.chapterId());
        }
        UUID promptId = UUID.randomUUID();
        String raw = aiScanService.generateExamQuestions(
                req.prompt(),
                buildAiMaterial(req),
                req.questionCount(),
                req.questionType(),
                req.difficulty());
        List<ExamAiDraftResponse.ExamAiDraftQuestion> questions =
                parseAiDraftQuestions(raw, req.questionType(), req.difficulty());
        List<String> sourceRefs = questions.stream()
                .flatMap(question -> question.sourceRefs().stream())
                .distinct()
                .toList();
        examAiAuditLogRepository.save(ExamAiAuditLog.create(
                promptId,
                me.userId(),
                courseId,
                AI_ACTION_GENERATED_DRAFT,
                req.prompt().trim(),
                toJson(sourceRefs)));
        return new ExamAiDraftResponse(promptId, questions, java.time.Instant.now());
    }

    @Transactional
    public void recordAiReview(UUID courseId, AuthenticatedUser me, ExamAiReviewRequest req) {
        loadOwnedCourse(courseId, me.userId());
        JsonNode sourceRefs = req.sourceRefs();
        examAiAuditLogRepository.save(ExamAiAuditLog.create(
                req.promptId(),
                me.userId(),
                courseId,
                req.action(),
                req.questionText().trim(),
                toJson(readStringArray(sourceRefs))));
    }

    @Transactional
    public ExamConfigResponse saveExam(UUID courseId, Integer slotIndex,
                                       AuthenticatedUser me, ExamConfigRequest req) {
        Course course = loadOwnedCourse(courseId, me.userId());
        Profile teacher = loadProfile(me.userId());
        validateSlot(slotIndex);
        validateRequest(req, me.userId());
        Chapter scopeStartChapter = loadCourseChapter(courseId, req.scopeStartChapterId());
        Chapter placementChapter = loadCourseChapter(courseId, req.placementChapterId());
        List<Chapter> courseChapters = chapterRepository.findWithLessonsByCourseId(courseId);
        String resolvedExamType = resolveExamType(courseChapters, placementChapter);
        validateExamChapterRange(courseId, scopeStartChapter, placementChapter);
        validateExamContentScope(courseChapters, scopeStartChapter, placementChapter, resolvedExamType);

        String questionsJson = toJson(req.questions());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElse(null);

        if (config == null) {
            config = ExamConfig.create(course, teacher, slotIndex, scopeStartChapter, placementChapter,
                    req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    resolvedExamType, req.requireFullscreen(), req.blockCopyPaste(),
                    questionsJson);
        } else {
            config.update(scopeStartChapter, placementChapter, req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    resolvedExamType, req.requireFullscreen(), req.blockCopyPaste(),
                    questionsJson);
        }

        ExamConfig saved = examRepository.save(config);
        recordApprovedAiQuestions(courseId, me.userId(), req);
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
        rewardService.recordAssessmentScore(
                saved.getStudent().getId(),
                RewardAssessmentType.EXAM,
                saved.getExamConfig().getId(),
                request.scorePercent());
        certificateService.handleFinalExamGradeChanged(saved);
        try {
            notifyStudentAboutExamGraded(saved);
        } catch (Exception ex) {
            log.warn("Could not notify student about graded exam attempt {}", attemptId, ex);
        }
        log.info("Teacher {} graded exam attempt {} with score={}",
                me.userId(), attemptId, request.scorePercent());
        return toTeacherExamAttemptResponse(saved);
    }

    private void notifyStudentAboutExamGraded(ExamAttempt attempt) {
        if (attempt.getStudent() == null || attempt.getExamConfig() == null
                || attempt.getExamConfig().getCourse() == null) {
            return;
        }
        ExamConfig config = attempt.getExamConfig();
        userNotificationService.notify(
                attempt.getStudent().getId(),
                "exam_graded",
                "Bài kiểm tra đã được chấm điểm",
                "Bài kiểm tra \"%s\" của bạn đã được giáo viên chấm xong.".formatted(config.getName()),
                "/courses/%s/exams/%s".formatted(config.getCourse().getId(), config.getSlotIndex())
        );
        log.info("Notified student {} about graded exam attempt {}",
                attempt.getStudent().getId(), attempt.getId());
    }

    private TeacherExamAttemptResponse toTeacherExamAttemptResponse(ExamAttempt attempt) {
        List<SnapshotExamQuestion> questions = readSnapshotQuestions(attempt.getQuestionsSnapshot());
        Map<String, SubmitExamRequest.ExamAnswerRequest> answers = readAnswers(attempt.getAnswers());
        List<TeacherExamAttemptResponse.QuestionReview> reviews = questions.stream()
                .map(question -> {
                    SubmitExamRequest.ExamAnswerRequest answer = answers.get(question.id());
                    List<Integer> studentAnswers = normalizeAnswer(
                            answer != null ? answer.selectedIndices() : null);
                    String textAnswer = answer != null ? trimToNull(answer.textAnswer()) : null;
                    List<String> imageUrls = normalizeImageUrls(answer != null ? answer.imageUrls() : null);
                    JsonNode answerData = answer != null ? answer.answerData() : null;
                    List<Integer> correctAnswers = normalizeAnswer(question.correctIndices());
                    Boolean correct = isManualQuestion(question)
                            ? null
                            : isAnswerCorrect(question, studentAnswers, textAnswer, answerData);
                    double points = question.points() != null ? question.points() : 0.0;
                    return new TeacherExamAttemptResponse.QuestionReview(
                            question.id(),
                            question.text(),
                            question.type(),
                            question.options(),
                            question.metadata(),
                            studentAnswers,
                            textAnswer,
                            imageUrls,
                            answerData,
                            correctAnswers,
                            correct,
                            points,
                            Boolean.TRUE.equals(correct) ? points : 0.0,
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
                effectivePassScorePercent(attempt.getExamConfig()),
                attempt.getPassed(),
                attempt.getTeacherFeedback(),
                attempt.getGradedAt(),
                attempt.getAiScorePercent() != null ? attempt.getAiScorePercent().doubleValue() : null,
                readAiFeedbackNode(attempt.getAiFeedback()),
                attempt.getAiGradedAt(),
                attempt.getGradedAt() == null ? "pending" : "graded",
                reviews);
    }

    private JsonNode readAiFeedbackNode(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            return node.isTextual() ? objectMapper.readTree(node.asText()) : node;
        } catch (Exception e) {
            log.warn("Không đọc được ai_feedback của exam attempt", e);
            return null;
        }
    }

    private Map<String, SubmitExamRequest.ExamAnswerRequest> readAnswers(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return readJsonValue(
                    json,
                    new TypeReference<Map<String, SubmitExamRequest.ExamAnswerRequest>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR",
                    "Không thể đọc đáp án bài kiểm tra.");
        }
    }

    private List<SnapshotExamQuestion> readSnapshotQuestions(String json) {
        try {
            return readJsonValue(
                    json,
                    new TypeReference<List<SnapshotExamQuestion>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR",
                    "Không thể đọc bài kiểm tra.");
        }
    }

    private <T> T readJsonValue(String json, TypeReference<T> type) throws JsonProcessingException {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException first) {
            String unwrapped = objectMapper.readValue(json, String.class);
            return objectMapper.readValue(unwrapped, type);
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

    private List<String> normalizeImageUrls(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .limit(10)
                .toList();
    }

    private boolean isManualQuestion(SnapshotExamQuestion question) {
        return MANUAL_EXAM_TYPES.contains(question.type());
    }

    private boolean isObjectiveQuestion(SnapshotExamQuestion question) {
        return OBJECTIVE_EXAM_TYPES.contains(question.type());
    }

    private boolean isTextAnswerQuestion(SnapshotExamQuestion question) {
        return TEXT_ANSWER_EXAM_TYPES.contains(question.type());
    }

    private void validateAnswerImages(
            UUID studentId,
            Map<String, SubmitExamRequest.ExamAnswerRequest> answers) {
        answers.values().stream()
                .filter(Objects::nonNull)
                .map(SubmitExamRequest.ExamAnswerRequest::imageUrls)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(url -> !url.isBlank())
                .forEach(url -> validateAnswerImageUrl(studentId, url));
    }

    private void validateAnswerImageUrl(UUID studentId, String url) {
        String examImagePath = "/storage/v1/object/public/" + EXAM_ANSWER_IMAGE_BUCKET
                + "/exam-answer-images/" + studentId + "/";
        String qaImagePath = "/storage/v1/object/public/" + EXAM_ANSWER_IMAGE_BUCKET
                + "/qa-images/" + studentId + "/";
        if (!url.contains(examImagePath) && !url.contains(qaImagePath)) {
            throw new BusinessException("INVALID_ATTACHMENT",
                    "Anh dap an khong hop le.", HttpStatus.BAD_REQUEST);
        }
    }

    private ExamScoringSummary scoreObjectiveQuestions(
            List<SnapshotExamQuestion> questions,
            Map<String, SubmitExamRequest.ExamAnswerRequest> answers) {
        double totalPoints = questions.stream()
                .map(SnapshotExamQuestion::points)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
        if (totalPoints <= 0.0) {
            totalPoints = EXAM_TOTAL_POINTS;
        }

        double earnedObjectivePoints = 0.0;
        int correctObjectiveCount = 0;
        int totalObjectiveCount = 0;
        boolean hasManualQuestion = false;

        for (SnapshotExamQuestion question : questions) {
            if (isManualQuestion(question)) {
                hasManualQuestion = true;
                continue;
            }
            totalObjectiveCount++;
            SubmitExamRequest.ExamAnswerRequest answer = answers.get(question.id());
            List<Integer> studentAnswers = normalizeAnswerToOriginalIndices(answer);
            String textAnswer = answer != null ? trimToNull(answer.textAnswer()) : null;
            JsonNode answerData = answer != null ? answer.answerData() : null;
            if (isAnswerCorrect(question, studentAnswers, textAnswer, answerData)) {
                correctObjectiveCount++;
                earnedObjectivePoints += question.points() != null ? question.points() : 0.0;
            }
        }

        double autoScorePercent = Math.round((earnedObjectivePoints / totalPoints) * 1000.0) / 10.0;
        return new ExamScoringSummary(
                autoScorePercent,
                correctObjectiveCount,
                totalObjectiveCount,
                hasManualQuestion);
    }

    private List<Integer> normalizeAnswerToOriginalIndices(SubmitExamRequest.ExamAnswerRequest answer) {
        if (answer == null) {
            return List.of();
        }
        List<Integer> selected = normalizeAnswer(answer.selectedIndices());
        JsonNode optionIndexMap = answer.answerData() != null
                ? answer.answerData().path("optionIndexMap")
                : null;
        if (optionIndexMap == null || !optionIndexMap.isArray() || optionIndexMap.isEmpty()) {
            return selected;
        }
        List<Integer> mapped = new ArrayList<>();
        for (Integer displayIndex : selected) {
            if (displayIndex != null
                    && displayIndex >= 0
                    && displayIndex < optionIndexMap.size()
                    && optionIndexMap.get(displayIndex).canConvertToInt()) {
                mapped.add(optionIndexMap.get(displayIndex).asInt());
            }
        }
        return normalizeAnswer(mapped);
    }

    private boolean isAnswerCorrect(
            SnapshotExamQuestion question,
            List<Integer> studentAnswers,
            String textAnswer,
            JsonNode answerData) {
        if (isObjectiveQuestion(question)) {
            return studentAnswers.equals(normalizeAnswer(question.correctIndices()));
        }
        if ("fill_in_blank".equals(question.type())) {
            return isFillInBlankCorrect(question.metadata(), textAnswer);
        }
        if ("matching".equals(question.type())) {
            return isMatchingCorrect(question.metadata(), answerData);
        }
        return false;
    }

    private boolean isFillInBlankCorrect(JsonNode metadata, String textAnswer) {
        if (textAnswer == null || textAnswer.isBlank() || metadata == null) {
            return false;
        }
        JsonNode acceptedAnswers = metadata.get("acceptedAnswers");
        if (acceptedAnswers == null || !acceptedAnswers.isArray()) {
            return false;
        }
        String normalizedAnswer = normalizeText(textAnswer);
        for (JsonNode node : acceptedAnswers) {
            if (node != null && node.isTextual() && normalizedAnswer.equals(normalizeText(node.asText()))) {
                return true;
            }
        }
        return false;
    }

    private boolean isMatchingCorrect(JsonNode metadata, JsonNode answerData) {
        if (metadata == null || answerData == null) {
            return false;
        }
        JsonNode correctPairs = metadata.get("matchingPairs");
        JsonNode studentPairs = answerData.get("matchingPairs");
        if (correctPairs == null || !correctPairs.isArray()
                || studentPairs == null || !studentPairs.isArray()
                || correctPairs.size() == 0
                || correctPairs.size() != studentPairs.size()) {
            return false;
        }
        for (int i = 0; i < correctPairs.size(); i++) {
            JsonNode correctPair = correctPairs.get(i);
            JsonNode studentPair = studentPairs.get(i);
            String correctLeft = correctPair.path("left").asText("");
            String correctRight = correctPair.path("right").asText("");
            String studentLeft = studentPair.path("left").asText("");
            String studentRight = studentPair.path("right").asText("");
            if (!normalizeText(correctLeft).equals(normalizeText(studentLeft))
                    || !normalizeText(correctRight).equals(normalizeText(studentRight))) {
                return false;
            }
        }
        return true;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    private int nullToZero(Integer value) {
        return value != null ? value : 0;
    }

    private int effectivePassScorePercent(ExamConfig config) {
        Integer value = config != null ? config.getPassScorePercent() : null;
        return value != null && value >= 0 ? value : 60;
    }

    private int enforceStudentAttemptWindow(UUID studentId, ExamConfig config) {
        int submittedCount = examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                studentId, config.getId());
        // BRULE-RETAKE-001: lượt được GV/Admin duyệt thêm cộng vào maxAttempts gốc.
        int allowedAttempts = config.getMaxAttempts()
                + examRetakeService.extraAttemptsGranted(studentId, config.getId());
        if (submittedCount >= allowedAttempts) {
            throw new BusinessException("RETAKE_LOCKED",
                    "Ban da het luot lam bai kiem tra. Hay gui yeu cau mo them luot neu can.",
                    HttpStatus.FORBIDDEN);
        }
        examAttemptRepository.findFirstByStudentIdAndExamConfigIdAndSubmittedAtIsNotNullOrderBySubmittedAtAsc(
                        studentId, config.getId())
                .filter(firstAttempt -> firstAttempt.getSubmittedAt() != null)
                .filter(firstAttempt -> firstAttempt.getSubmittedAt()
                        .isBefore(Instant.now().minus(RETAKE_WINDOW_DAYS, ChronoUnit.DAYS)))
                // Lần duyệt gần nhất mở lại cửa sổ làm bài đến retake_expire_at.
                .filter(firstAttempt -> !examRetakeService.hasActiveRetakeWindow(studentId, config.getId()))
                .ifPresent(firstAttempt -> {
                    throw new BusinessException("RETAKE_LOCKED",
                            "Da qua han 14 ngay ke tu lan nop dau tien. Hay gui yeu cau mo them luot.",
                            HttpStatus.FORBIDDEN);
                });
        return submittedCount;
    }

    private boolean isFixedExamSlot(Integer slotIndex) {
        return slotIndex != null && slotIndex >= 0 && slotIndex < FIXED_EXAM_SLOT_COUNT;
    }

    private String buildAiMaterial(ExamAiDraftRequest req) {
        List<String> parts = new ArrayList<>();
        if (req.chapterId() != null) {
            parts.add("chapter_id=" + req.chapterId());
        }
        if (req.material() != null && !req.material().isBlank()) {
            parts.add(req.material().trim());
        }
        return String.join("\n", parts);
    }

    private List<ExamAiDraftResponse.ExamAiDraftQuestion> parseAiDraftQuestions(
            String raw, String expectedType, String expectedDifficulty) {
        try {
            JsonNode root = objectMapper.readTree(extractJsonArray(raw));
            if (!root.isArray() || root.isEmpty()) {
                throw new IllegalArgumentException("AI response is not a non-empty array");
            }
            List<ExamAiDraftResponse.ExamAiDraftQuestion> result = new ArrayList<>();
            for (JsonNode node : root) {
                String type = node.path("type").asText("");
                String difficulty = node.path("difficulty").asText("");
                String text = node.path("text").asText("");
                if (!expectedType.equals(type) || !expectedDifficulty.equals(difficulty)
                        || text.isBlank()) {
                    throw new IllegalArgumentException("AI question schema mismatch");
                }
                List<String> options = readStringArray(node.path("options"));
                List<Integer> correctIndices = readIntegerArray(node.path("correctIndices"));
                JsonNode metadata = node.path("metadata").isMissingNode()
                        || node.path("metadata").isNull()
                        ? objectMapper.createObjectNode()
                        : node.path("metadata");
                validateAiQuestionSchema(type, options, correctIndices, metadata);
                List<String> sourceRefs = readStringArray(node.path("sourceRefs"));
                String rejectionReason = aiRejectionReason(text, sourceRefs);
                String status = rejectionReason == null ? "draft" : "rejected";
                result.add(new ExamAiDraftResponse.ExamAiDraftQuestion(
                        status,
                        text,
                        type,
                        options,
                        correctIndices,
                        metadata,
                        node.path("explanation").isNull() ? null : node.path("explanation").asText(null),
                        difficulty,
                        sourceRefs,
                        rejectionReason));
            }
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("AI_SCHEMA_INVALID",
                    "AI Engine tra ve cau hoi khong dung schema, chua them vao bai kiem tra.",
                    HttpStatus.BAD_GATEWAY);
        }
    }

    private String extractJsonArray(String raw) {
        if (raw == null) {
            return "[]";
        }
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return raw;
        }
        return raw.substring(start, end + 1);
    }

    private String aiRejectionReason(String text, List<String> sourceRefs) {
        if (sourceRefs == null || sourceRefs.isEmpty()) {
            return "AI question missing source_refs.";
        }
        String normalized = text == null ? "" : text.toLowerCase();
        List<String> blockedTerms = List.of(
                "kill yourself",
                "suicide method",
                "make a bomb",
                "bypass exam",
                "steal password",
                "hate speech");
        boolean violatesPolicy = blockedTerms.stream().anyMatch(normalized::contains);
        return violatesPolicy ? "AI question may violate content policy." : null;
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String value = item.asText("");
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private List<Integer> readIntegerArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<Integer> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.canConvertToInt()) {
                values.add(item.asInt());
            }
        }
        return values;
    }

    private void validateAiQuestionSchema(String type, List<String> options,
                                          List<Integer> correctIndices, JsonNode metadata) {
        if (OBJECTIVE_EXAM_TYPES.contains(type)
                && (options.size() < 2 || correctIndices.isEmpty())) {
            throw new IllegalArgumentException("objective AI question missing options");
        }
        if ("fill_in_blank".equals(type)
                && (metadata == null || !metadata.path("acceptedAnswers").isArray()
                || metadata.path("acceptedAnswers").isEmpty())) {
            throw new IllegalArgumentException("fill-in-blank AI question missing accepted answers");
        }
        if ("essay".equals(type)
                && (metadata == null || metadata.path("rubric").asText("").isBlank())) {
            throw new IllegalArgumentException("essay AI question missing rubric");
        }
    }

    private record SnapshotExamQuestion(
            String id,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            JsonNode metadata,
            String explanation,
            Double points,
            String difficulty
    ) {}

    private record ExamScoringSummary(
            double autoScorePercent,
            int correctObjectiveCount,
            int totalObjectiveCount,
            boolean hasEssay
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

    private void requireStudentEnrollment(UUID courseId, UUID studentId) {
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course", courseId);
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            throw new BusinessException(
                    "COURSE_NOT_ENROLLED",
                    "Ban can ghi danh khoa hoc truoc khi lam bai kiem tra.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private Profile loadProfile(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", profileId));
    }

    private void validateSlot(Integer slotIndex) {
        if (!isFixedExamSlot(slotIndex)) {
            throw new BusinessException("INVALID_SLOT", "Vị trí bài kiểm tra không hợp lệ.");
        }
    }

    private void validateQuestionReferenceIfNeeded(ExamConfigRequest.ExamQuestionRequest q, UUID teacherId) {
        if (isApprovedAiQuestion(q) || isDirectExamQuestion(q)) {
            return;
        }
        if (q.id() == null || q.id().isBlank()) {
            return;
        }
        try {
            UUID questionId = UUID.fromString(q.id());
            Question question = questionRepository.findById(questionId)
                    .orElseThrow(() -> new BusinessException("QUESTION_NOT_FROM_BANK",
                            "Tat ca cau hoi bai kiem tra phai lay tu ngan hang cau hoi."));
            if (!"active".equals(question.getStatus())) {
                throw new BusinessException("QUESTION_INACTIVE",
                        "Cau hoi da bi an khong the dua vao bai kiem tra.");
            }
            if (question.getTeacher() == null || !teacherId.equals(question.getTeacher().getId())) {
                throw new BusinessException("QUESTION_NOT_FROM_BANK",
                        "Tat ca cau hoi bai kiem tra phai lay tu ngan hang cau hoi cua giao vien.");
            }
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("QUESTION_NOT_FROM_BANK",
                    "Tat ca cau hoi bai kiem tra phai lay tu ngan hang cau hoi.");
        }
    }

    private boolean isApprovedAiQuestion(ExamConfigRequest.ExamQuestionRequest q) {
        return q.id() != null && q.id().startsWith("ai-")
                && q.metadata() != null
                && !q.metadata().path("aiPromptId").asText("").isBlank()
                && AI_STATUS_APPROVED.equals(q.metadata().path("aiStatus").asText(""))
                && q.metadata().path("sourceRefs").isArray()
                && !q.metadata().path("sourceRefs").isEmpty();
    }

    private boolean isDirectExamQuestion(ExamConfigRequest.ExamQuestionRequest q) {
        if (q.id() != null && (q.id().startsWith("manual-") || q.id().startsWith("direct-"))) {
            return true;
        }
        if (q.metadata() == null) {
            return false;
        }
        return "direct_exam".equals(q.metadata().path("sourceType").asText(""))
                || q.metadata().path("createdInExam").asBoolean(false);
    }

    private void validateRequest(ExamConfigRequest req, UUID teacherId) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu bài kiểm tra không hợp lệ.");
        }
        if (req.questions() == null || req.questions().isEmpty()) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Bài kiểm tra phải có ít nhất 1 câu hỏi.");
        }
        if (req.questions().size() < 10 && !req.confirmUnderTenQuestions()) {
            throw new BusinessException("EXAM_UNDER_MIN_QUESTIONS",
                    "Bai kiem tra co duoi 10 cau. Giao vien can xac nhan truoc khi luu.",
                    HttpStatus.BAD_REQUEST);
        }
        for (int i = 0; i < req.questions().size(); i++) {
            ExamConfigRequest.ExamQuestionRequest q = req.questions().get(i);
            if (q == null || q.type() == null || q.points() == null) {
                throw new BusinessException("INVALID_QUESTIONS",
                        "Câu " + (i + 1) + " không hợp lệ.");
            }
            validateAiQuestionReviewState(q, i + 1);
            validateQuestionReferenceIfNeeded(q, teacherId);
            if (MANUAL_EXAM_TYPES.contains(q.type())) {
                if (!hasManualRubric(q)) {
                    throw new BusinessException("ESSAY_RUBRIC_REQUIRED",
                            "Cau " + (i + 1) + " tu luan phai co barem cham.",
                            HttpStatus.BAD_REQUEST);
                }
                continue;
            }
            if (OBJECTIVE_EXAM_TYPES.contains(q.type())) {
                if (q.options() == null || q.options().size() < 2
                        || q.correctIndices() == null || q.correctIndices().isEmpty()) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Cau " + (i + 1) + " trac nghiem phai co lua chon va dap an dung.");
                }
                if ("true_false".equals(q.type()) && q.correctIndices().size() != 1) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Cau " + (i + 1) + " dung sai phai co dung 1 dap an dung.");
                }
                int optionCount = q.options().size();
                for (Integer correctIndex : q.correctIndices()) {
                    if (correctIndex == null || correctIndex < 0 || correctIndex >= optionCount) {
                        throw new BusinessException("INVALID_QUESTIONS",
                                "Cau " + (i + 1) + " co dap an dung khong hop le.");
                    }
                }
                continue;
            }
            if ("fill_in_blank".equals(q.type())) {
                if (q.metadata() == null || q.metadata().get("acceptedAnswers") == null
                        || !q.metadata().get("acceptedAnswers").isArray()
                        || q.metadata().get("acceptedAnswers").isEmpty()) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Cau " + (i + 1) + " dien cho trong phai co dap an chap nhan.");
                }
                continue;
            }
            if ("matching".equals(q.type())) {
                if (q.metadata() == null || q.metadata().get("matchingPairs") == null
                        || !q.metadata().get("matchingPairs").isArray()
                        || q.metadata().get("matchingPairs").size() < 2) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Cau " + (i + 1) + " noi cot phai co it nhat 2 cap dap an.");
                }
                continue;
            }
            throw new BusinessException("INVALID_QUESTIONS",
                    "Cau " + (i + 1) + " co loai cau hoi khong duoc ho tro.");
        }
        validateExamPointsAndSections(req);
    }

    private void validateAiQuestionReviewState(ExamConfigRequest.ExamQuestionRequest q, int position) {
        if (q.metadata() == null || q.metadata().path("aiPromptId").asText("").isBlank()) {
            return;
        }
        String aiStatus = q.metadata().path("aiStatus").asText("");
        if ("rejected".equals(aiStatus)) {
            throw new BusinessException("AI_QUESTION_REJECTED",
                    "Cau " + position + " da bi tu choi, khong the luu vao bai kiem tra.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!AI_STATUS_APPROVED.equals(aiStatus)) {
            throw new BusinessException("AI_QUESTION_NOT_APPROVED",
                    "Cau " + position + " do AI tao phai duoc giao vien approve truoc khi luu.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!q.metadata().path("sourceRefs").isArray() || q.metadata().path("sourceRefs").isEmpty()) {
            throw new BusinessException("AI_SOURCE_REFS_REQUIRED",
                    "Cau " + position + " do AI tao phai co source_refs.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private boolean hasManualRubric(ExamConfigRequest.ExamQuestionRequest q) {
        if (q.explanation() != null && !q.explanation().isBlank()) {
            return true;
        }
        JsonNode metadata = q.metadata();
        return metadata != null
                && (!metadata.path("rubric").asText("").isBlank()
                || !metadata.path("sampleAnswer").asText("").isBlank());
    }

    private void recordApprovedAiQuestions(UUID courseId, UUID teacherId, ExamConfigRequest req) {
        req.questions().stream()
                .filter(q -> q.metadata() != null
                        && !q.metadata().path("aiPromptId").asText("").isBlank())
                .forEach(q -> {
                    UUID promptId = UUID.fromString(q.metadata().path("aiPromptId").asText());
                    examAiAuditLogRepository.save(ExamAiAuditLog.create(
                            promptId,
                            teacherId,
                            courseId,
                            AI_ACTION_APPROVED,
                            q.text(),
                            toJson(readStringArray(q.metadata().path("sourceRefs")))));
                });
    }

    private void validateExamPointsAndSections(ExamConfigRequest req) {
        long objectiveCount = req.questions().stream()
                .filter(q -> OBJECTIVE_EXAM_TYPES.contains(q.type()) || TEXT_ANSWER_EXAM_TYPES.contains(q.type()))
                .count();
        long manualCount = req.questions().stream()
                .filter(q -> MANUAL_EXAM_TYPES.contains(q.type()))
                .count();
        if (objectiveCount == 0 || manualCount == 0) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Bai kiem tra phai co ca phan tu dong cham va phan can giao vien cham.");
        }
        double totalPoints = req.questions().stream()
                .map(ExamConfigRequest.ExamQuestionRequest::points)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
        if (Math.abs(totalPoints - EXAM_TOTAL_POINTS) > 0.001) {
            throw new BusinessException("INVALID_POINTS",
                    "Tong diem phan trac nghiem va tu luan phai bang 10 diem.");
        }
    }

    private void validateExamChapterRange(UUID courseId, Chapter scopeStartChapter, Chapter placementChapter) {
        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        int startIndex = indexOfChapter(chapters, scopeStartChapter.getId());
        int endIndex = indexOfChapter(chapters, placementChapter.getId());
        if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
            throw new BusinessException("INVALID_EXAM_SCOPE",
                    "Chuong bat dau phai dung truoc hoac bang chuong ket thuc.");
        }
    }

    private String resolveExamType(List<Chapter> chapters, Chapter placementChapter) {
        if (chapters.isEmpty()) {
            return EXAM_TYPE_CHAPTER_TEST;
        }
        Chapter last = chapters.get(chapters.size() - 1);
        return last.getId().equals(placementChapter.getId())
                ? EXAM_TYPE_FINAL_EXAM
                : EXAM_TYPE_CHAPTER_TEST;
    }

    private void validateExamContentScope(List<Chapter> chapters, Chapter scopeStartChapter,
                                          Chapter placementChapter, String examType) {
        if (chapters.size() < 3) {
            throw new BusinessException("COURSE_MIN_CHAPTERS_REQUIRED",
                    "Khoa hoc phai co toi thieu 3 chuong truoc khi tao bai kiem tra.",
                    HttpStatus.BAD_REQUEST);
        }
        List<Chapter> scopedChapters = scopedChapters(chapters,
                scopeStartChapter.getId(), placementChapter.getId());
        if (scopedChapters.isEmpty()) {
            throw new BusinessException("INVALID_EXAM_SCOPE",
                    "Pham vi bai kiem tra khong hop le.",
                    HttpStatus.BAD_REQUEST);
        }
        for (Chapter chapter : scopedChapters) {
            if (chapter.getLessons().isEmpty()) {
                throw new BusinessException("CHAPTER_LESSON_REQUIRED",
                        "Moi chuong trong pham vi bai kiem tra phai co it nhat 1 bai hoc.",
                        HttpStatus.BAD_REQUEST);
            }
        }
        if (EXAM_TYPE_FINAL_EXAM.equals(examType)) {
            Chapter first = chapters.get(0);
            Chapter last = chapters.get(chapters.size() - 1);
            if (!first.getId().equals(scopeStartChapter.getId())
                    || !last.getId().equals(placementChapter.getId())) {
                throw new BusinessException("FINAL_EXAM_SCOPE_REQUIRED",
                        "Final exam phai ap dung cho toan bo khoa hoc.",
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void requireExamUnlockedForStudent(ExamConfig config, UUID studentId) {
        if (!isExamUnlockedForStudent(config, studentId)) {
            throw new BusinessException("EXAM_LOCKED",
                    "Bai kiem tra chi mo khi ban hoan thanh 100% noi dung trong pham vi.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private boolean isExamUnlockedForStudent(ExamConfig config, UUID studentId) {
        if (config == null || config.getCourse() == null
                || config.getScopeStartChapter() == null
                || config.getPlacementChapter() == null) {
            return false;
        }
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(config.getCourse().getId());
        List<Chapter> scoped = scopedChapters(
                chapters,
                config.getScopeStartChapter().getId(),
                config.getPlacementChapter().getId());
        List<UUID> lessonIds = scoped.stream()
                .flatMap(chapter -> chapter.getLessons().stream())
                .map(Lesson::getId)
                .toList();
        if (lessonIds.isEmpty()) {
            return false;
        }
        Set<UUID> completedLessonIds = progressItemRepository
                .findByStudentIdAndCourseId(studentId, config.getCourse().getId())
                .stream()
                .filter(item -> ITEM_LESSON.equals(item.getItemType()))
                .map(item -> item.getItemId())
                .collect(java.util.stream.Collectors.toSet());
        return completedLessonIds.containsAll(lessonIds);
    }

    private List<Chapter> scopedChapters(List<Chapter> chapters, UUID startChapterId, UUID endChapterId) {
        int start = indexOfChapter(chapters, startChapterId);
        int end = indexOfChapter(chapters, endChapterId);
        if (start < 0 || end < 0 || start > end) {
            return List.of();
        }
        return chapters.subList(start, end + 1);
    }

    private int indexOfChapter(List<Chapter> chapters, UUID chapterId) {
        for (int i = 0; i < chapters.size(); i++) {
            if (chapters.get(i).getId().equals(chapterId)) {
                return i;
            }
        }
        return -1;
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
        if (req.objectivePoints() == null || req.essayPoints() == null) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Phân bổ câu hỏi random không hợp lệ.");
        }
        int total = 0;
        int objectiveTotal = 0;
        int manualTotal = 0;
        for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                : req.chapterConfigs()) {
            if (chapterReq.chapterId() == null
                    || chapterReq.totalCount() == null) {
                throw new BusinessException("INVALID_RANDOM_CONFIG",
                        "Phân bổ câu hỏi theo chương không hợp lệ.");
            }
            total += chapterReq.totalCount();
            int typedTotal = chapterObjectiveCount(chapterReq) + chapterEssayCount(chapterReq);
            if (typedTotal > 0 && typedTotal != chapterReq.totalCount()) {
                throw new BusinessException("INVALID_RANDOM_CONFIG",
                        "Tong so cau trac nghiem va tu luan phai bang so cau cua chuong.");
            }
            objectiveTotal += chapterObjectiveCount(chapterReq);
            manualTotal += chapterEssayCount(chapterReq);
        }
        if (objectiveTotal <= 0 || manualTotal <= 0) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Bai kiem tra phai co ca phan tu dong cham va phan can giao vien cham.");
        }
        if (Math.abs(req.objectivePoints() + req.essayPoints() - EXAM_TOTAL_POINTS) > 0.001) {
            throw new BusinessException("INVALID_POINTS",
                    "Tong diem phan trac nghiem va tu luan phai bang 10 diem.");
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

    private int chapterObjectiveCount(ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq) {
        if (hasDetailedTypeSplit(chapterReq)) {
            return nullToZero(chapterReq.multipleChoiceCount())
                    + nullToZero(chapterReq.trueFalseCount())
                    + nullToZero(chapterReq.fillInBlankCount());
        }
        return nullToZero(chapterReq.objectiveCount());
    }

    private int chapterEssayCount(ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq) {
        return nullToZero(chapterReq.essayCount());
    }

    private boolean hasDetailedTypeSplit(ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq) {
        return chapterReq.multipleChoiceCount() != null
                || chapterReq.trueFalseCount() != null
                || chapterReq.fillInBlankCount() != null;
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

    private List<Question> pickRandomQuestionsByChapter(
            UUID teacherId,
            UUID chapterId,
            ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq) {
        int count = chapterReq.totalCount();
        if (count <= 0) {
            return List.of();
        }
        int multipleChoiceCount = nullToZero(chapterReq.multipleChoiceCount());
        int trueFalseCount = nullToZero(chapterReq.trueFalseCount());
        int fillInBlankCount = nullToZero(chapterReq.fillInBlankCount());
        int objectiveCount = chapterObjectiveCount(chapterReq);
        int essayCount = chapterEssayCount(chapterReq);
        if (hasDetailedTypeSplit(chapterReq)) {
            List<Question> selected = new ArrayList<>();
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, List.of("multiple_choice"),
                    multipleChoiceCount, "trac nghiem"));
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, List.of("true_false"),
                    trueFalseCount, "dung sai"));
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, List.of("fill_in_blank"),
                    fillInBlankCount, "dien cho trong"));
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, RANDOM_SUPPORTED_ESSAY_TYPES,
                    essayCount, "tu luan"));
            Collections.shuffle(selected);
            return selected;
        }
        if (objectiveCount + essayCount > 0) {
            List<Question> selected = new ArrayList<>();
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, RANDOM_SUPPORTED_OBJECTIVE_TYPES,
                    objectiveCount, "trac nghiem"));
            selected.addAll(pickRandomQuestionsByChapterAndTypes(
                    teacherId, chapterId, RANDOM_SUPPORTED_ESSAY_TYPES,
                    essayCount, "tu luan"));
            Collections.shuffle(selected);
            return selected;
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

    private List<Question> pickRandomQuestionsByChapterAndTypes(
            UUID teacherId, UUID chapterId, List<String> types, int count, String label) {
        if (count <= 0) return List.of();
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByTeacherAndChapterAndTypes(teacherId, chapterId, types));
        if (pool.size() < count) {
            throw new BusinessException("QUESTION_BANK_NOT_ENOUGH",
                    "Ngan hang cau hoi chua du cau " + label + ": can " + count
                            + ", hien co " + pool.size() + ".");
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
        return new ExamConfigResponse.ExamQuestionResponse(
                question.getId().toString(),
                question.getContent(),
                question.getType(),
                options,
                correctIndices,
                QuestionResponse.forStudent(question, objectMapper).metadata(),
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
