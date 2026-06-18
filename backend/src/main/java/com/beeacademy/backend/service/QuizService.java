package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.QuizConfigRequest;
import com.beeacademy.backend.dto.request.SubmitQuizRequest;
import com.beeacademy.backend.dto.response.QuizAttemptStartResponse;
import com.beeacademy.backend.dto.response.QuizConfigResponse;
import com.beeacademy.backend.dto.response.QuizResultResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Nghiệp vụ Quiz (Phase 5–6).
 *
 * <p>Hai luồng chính:
 * <ul>
 *   <li>GV: cấu hình quiz ({@link #saveConfig}).</li>
 *   <li>Student: bắt đầu làm ({@link #startAttempt}) → nộp bài
 *       ({@link #submitAttempt}) → xem kết quả ({@link #getResult}).</li>
 * </ul>
 *
 * <p><b>Bảo mật đáp án:</b> {@code questionsSnapshot} (JSONB trong DB)
 * lưu đáp án đúng. Response trả cho student KHÔNG có {@code isCorrect}.
 * Chỉ sau khi {@code submitAttempt} mới trả kết quả kèm giải thích.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {

    private final QuizConfigRepository  configRepository;
    private final QuizAttemptRepository attemptRepository;
    private final QuestionRepository    questionRepository;
    private final ChapterRepository     chapterRepository;
    private final EnrollmentRepository  enrollmentRepository;
    private final ProfileRepository     profileRepository;
    private final ObjectMapper          objectMapper;

    // ========================================================================
    // GV: quản lý config
    // ========================================================================

    /** Upsert cấu hình quiz cho một chương. */
    @Transactional
    public QuizConfigResponse saveConfig(UUID chapterId, AuthenticatedUser me,
                                          QuizConfigRequest req) {
        String mode = req.selectionMode() != null ? req.selectionMode() : "random";

        if ("random".equals(mode)) {
            // Validate tổng số câu chỉ khi random
            int total = req.easyCount() + req.mediumCount() + req.hardCount();
            if (total != req.totalQuestions()) {
                throw new BusinessException("INVALID_CONFIG",
                        "Tổng (Dễ + Trung bình + Khó) = " + total
                        + " phải bằng Tổng số câu = " + req.totalQuestions() + ".");
            }
        } else {
            // manual: totalQuestions = số câu được chọn
            if (req.selectedQuestionIds() == null || req.selectedQuestionIds().isEmpty()) {
                throw new BusinessException("INVALID_CONFIG",
                        "Chế độ thủ công cần chọn ít nhất 1 câu hỏi.");
            }
        }

        Profile teacher = loadProfile(me.userId());

        // Số câu thực tế
        int totalQ = "manual".equals(mode) && req.selectedQuestionIds() != null
                ? req.selectedQuestionIds().size()
                : req.totalQuestions();

        QuizConfig config = configRepository.findByChapterId(chapterId).orElse(null);
        if (config == null) {
            config = QuizConfig.create(
                    loadChapterRef(chapterId), teacher,
                    totalQ, req.easyCount(),
                    req.mediumCount(), req.hardCount(),
                    req.timeLimitMinutes(), req.passingScore(),
                    req.shuffleQuestions(), req.shuffleChoices(),
                    req.maxAttempts(), mode, req.selectedQuestionIds());
        } else {
            config.update(totalQ, req.easyCount(),
                    req.mediumCount(), req.hardCount(),
                    req.timeLimitMinutes(), req.passingScore(),
                    req.shuffleQuestions(), req.shuffleChoices(),
                    req.maxAttempts(), mode, req.selectedQuestionIds());
        }
        return QuizConfigResponse.fromEntity(configRepository.save(config));
    }

    @Transactional(readOnly = true)
    public QuizConfigResponse getConfig(UUID chapterId) {
        return configRepository.findByChapterId(chapterId)
                .map(QuizConfigResponse::fromEntity)
                .orElseThrow(() -> new BusinessException("NOT_FOUND",
                        "Chương này chưa có cấu hình quiz.", HttpStatus.NOT_FOUND));
    }

    // ========================================================================
    // Student: làm quiz
    // ========================================================================

    /**
     * Học sinh bắt đầu một lượt làm quiz.
     *
     * <p>Luồng:
     * <ol>
     *   <li>Verify đã enroll.</li>
     *   <li>Kiểm tra max_attempts.</li>
     *   <li>Random pick câu theo easyCount / mediumCount / hardCount.</li>
     *   <li>Lưu snapshot (kèm đáp án đúng) vào DB.</li>
     *   <li>Trả câu hỏi cho FE — ĐÃ ẨN {@code isCorrect}.</li>
     * </ol>
     */
    @Transactional
    public QuizAttemptStartResponse startAttempt(UUID chapterId, AuthenticatedUser me) {
        QuizConfig config = configRepository.findByChapterId(chapterId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND",
                        "Chương này chưa có quiz.", HttpStatus.NOT_FOUND));

        // Verify enrollment (chapter → course → check enrollments)
        UUID courseId = config.getChapter().getCourse().getId();
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException("NOT_ENROLLED",
                    "Bạn chưa mua khóa học này.", HttpStatus.FORBIDDEN);
        }

        // Kiểm tra max attempts — chỉ đếm lượt đã NỘP, bỏ qua attempt chưa nộp.
        // Student tắt browser / mất kết nối giữa chừng sẽ không bị mất lượt oan.
        int attemptCount = attemptRepository.countByStudentIdAndQuizConfigIdAndSubmittedAtIsNotNull(
                me.userId(), config.getId());
        if (config.getMaxAttempts() != null && attemptCount >= config.getMaxAttempts()) {
            throw new BusinessException("MAX_ATTEMPTS_REACHED",
                    "Bạn đã hết lượt làm quiz (" + config.getMaxAttempts() + " lần).");
        }

        // Pick câu hỏi theo chế độ
        List<Question> selected;
        if ("manual".equals(config.getSelectionMode())
                && config.getSelectedQuestionIds() != null
                && !config.getSelectedQuestionIds().isEmpty()) {
            selected = new ArrayList<>(
                    questionRepository.findAllById(config.getSelectedQuestionIds()));
        } else {
            selected = randomPickQuestions(chapterId, config);
        }
        if (config.getShuffleQuestions()) Collections.shuffle(selected);

        // Shuffle choices một lần duy nhất — dùng chung cho snapshot và response.
        // Nếu shuffle 2 lần độc lập, thứ tự choices trong snapshot khác response,
        // gây sai lệch position hiển thị dù chấm điểm vẫn đúng (dùng UUID).
        Map<UUID, List<QuestionChoice>> shuffledChoicesMap = buildShuffledChoices(selected, config.getShuffleChoices());

        // Build snapshot JSON (kèm đáp án đúng)
        String snapshotJson = buildSnapshot(selected, shuffledChoicesMap);

        // Lưu attempt
        Profile student = loadProfile(me.userId());
        QuizAttempt attempt = QuizAttempt.start(student, config, snapshotJson,
                                                 attemptCount + 1);
        QuizAttempt saved = attemptRepository.save(attempt);
        log.info("Student {} bắt đầu quiz chương {} (attempt #{})",
                 me.userId(), chapterId, attemptCount + 1);

        // Build response — ẨN isCorrect, dùng cùng shuffledChoicesMap để position khớp snapshot
        List<QuizAttemptStartResponse.QuestionForStudent> questions =
                buildStudentQuestions(selected, shuffledChoicesMap);

        return new QuizAttemptStartResponse(
                saved.getId(),
                config.getTimeLimitMinutes(),
                config.getTotalQuestions(),
                attemptCount + 1,
                questions);
    }

    /** Học sinh nộp bài — chấm điểm và trả kết quả. */
    @Transactional
    public QuizResultResponse submitAttempt(UUID attemptId, AuthenticatedUser me,
                                             SubmitQuizRequest req) {
        QuizAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("QuizAttempt", attemptId));

        if (attempt.getSubmittedAt() != null) {
            throw new BusinessException("ALREADY_SUBMITTED",
                    "Bài thi này đã được nộp rồi.");
        }

        // Deserialize snapshot để lấy đáp án đúng
        Map<UUID, SnapshotQuestion> snapshot = deserializeSnapshot(attempt.getQuestionsSnapshot());

        // Chấm điểm
        int correct = 0;
        List<QuizResultResponse.QuestionResult> details = new ArrayList<>();
        List<UUID> usedQuestionIds = new ArrayList<>(snapshot.keySet());

        for (Map.Entry<UUID, SnapshotQuestion> entry : snapshot.entrySet()) {
            UUID questionId = entry.getKey();
            SnapshotQuestion sq = entry.getValue();

            UUID studentAnswer = req.answers() != null ? req.answers().get(questionId) : null;
            UUID correctAnswer = sq.correctChoiceId();
            boolean isRight = correctAnswer != null && correctAnswer.equals(studentAnswer);
            if (isRight) correct++;

            details.add(new QuizResultResponse.QuestionResult(
                    questionId, sq.content(),
                    studentAnswer, correctAnswer, isRight, sq.explanation()));
        }

        int total = snapshot.size();

        // Công thức tính điểm theo thang 10 (không phải 100):
        //   correct/total * 100  → phần trăm đúng (0–100)
        //   Math.round(...)      → làm tròn đến số nguyên gần nhất (long)
        //   / 10.0               → chuyển về thang 10, giữ 1 chữ số thập phân
        // Ví dụ: 7/10 đúng → round(70.0) / 10.0 = 7.0
        //         7/8  đúng → round(87.5) / 10.0 = 8.8
        // passingScore trong QuizConfig cũng theo thang 10 (ví dụ: 5.0 = đạt 50%).
        double score = total > 0 ? Math.round((double) correct / total * 100.0) / 10.0 : 0.0;
        double passingScore = attempt.getQuizConfig().getPassingScore().doubleValue();
        boolean passed = score >= passingScore;

        // Serialize answers
        String answersJson = serializeAnswers(req.answers());
        attempt.submit(answersJson, score, passed);
        attemptRepository.save(attempt);

        // Tăng usage_count cho các câu đã dùng
        questionRepository.incrementUsageCount(usedQuestionIds);

        log.info("Student {} nộp quiz {} — score={}/10 passed={}",
                 me.userId(), attemptId, score, passed);

        return new QuizResultResponse(
                attemptId, score, passed, correct, total,
                attempt.getAttemptNumber(), details);
    }

    /** Xem kết quả một lượt làm bài (đã nộp). */
    @Transactional(readOnly = true)
    public QuizResultResponse getResult(UUID attemptId, AuthenticatedUser me) {
        QuizAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("QuizAttempt", attemptId));
        if (attempt.getSubmittedAt() == null) {
            throw new BusinessException("NOT_SUBMITTED", "Bài thi chưa được nộp.");
        }

        Map<UUID, SnapshotQuestion> snapshot = deserializeSnapshot(attempt.getQuestionsSnapshot());
        Map<UUID, UUID> answers = deserializeAnswers(attempt.getAnswers());

        int correct = 0;
        List<QuizResultResponse.QuestionResult> details = new ArrayList<>();
        for (Map.Entry<UUID, SnapshotQuestion> entry : snapshot.entrySet()) {
            UUID qId = entry.getKey();
            SnapshotQuestion sq = entry.getValue();
            UUID studentAns = answers != null ? answers.get(qId) : null;
            UUID correctAns = sq.correctChoiceId();
            boolean isRight = correctAns != null && correctAns.equals(studentAns);
            if (isRight) correct++;
            details.add(new QuizResultResponse.QuestionResult(
                    qId, sq.content(), studentAns, correctAns, isRight, sq.explanation()));
        }

        return new QuizResultResponse(
                attemptId,
                attempt.getScore() != null ? attempt.getScore().doubleValue() : 0.0,
                attempt.getPassed(), correct, snapshot.size(),
                attempt.getAttemptNumber(), details);
    }

    // ========================================================================
    // Private — randomize
    // ========================================================================

    /** Lấy câu theo chapter + difficulty, shuffle từng pool, pick min(count, poolSize). */
    private List<Question> randomPickQuestions(UUID chapterId, QuizConfig config) {
        List<Question> result = new ArrayList<>();
        UUID categoryId = config.getChapter().getCourse().getCategory().getId();
        List<Integer> grades = Arrays.stream(config.getChapter().getCourse().getGrades())
                .boxed()
                .toList();
        result.addAll(pickFromPool(categoryId, grades, "easy",   config.getEasyCount()));
        result.addAll(pickFromPool(categoryId, grades, "medium", config.getMediumCount()));
        result.addAll(pickFromPool(categoryId, grades, "hard",   config.getHardCount()));
        return result;
    }

    private List<Question> pickFromPool(UUID categoryId, List<Integer> grades, String difficulty, int count) {
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByCategoryAndGradesAndDifficulty(categoryId, grades, difficulty));
        Collections.shuffle(pool);
        if (pool.size() < count) {
            log.warn("Ngân hàng câu hỏi category={} grades={} difficulty={} thiếu câu: cần={} có={}",
                     categoryId, grades, difficulty, count, pool.size());
        }
        return pool.subList(0, Math.min(count, pool.size()));
    }

    // ========================================================================
    // Private — JSON snapshot
    // ========================================================================

    /**
     * Snapshot record — lưu đủ thông tin để chấm điểm mà không query DB lại.
     * Field names phải khớp khi deserialize.
     */
    private record SnapshotQuestion(
            String content,
            String explanation,
            UUID correctChoiceId,
            List<SnapshotChoice> choices
    ) {}

    private record SnapshotChoice(UUID id, String content, boolean isCorrect, int position) {}

    /**
     * Shuffle choices một lần duy nhất cho mỗi câu hỏi.
     * Kết quả được chia sẻ cho cả buildSnapshot (lưu DB) lẫn buildStudentQuestions (trả FE)
     * để đảm bảo position choices nhất quán.
     */
    private Map<UUID, List<QuestionChoice>> buildShuffledChoices(List<Question> questions,
                                                                   boolean shuffleChoices) {
        Map<UUID, List<QuestionChoice>> result = new LinkedHashMap<>();
        for (Question q : questions) {
            List<QuestionChoice> choices = new ArrayList<>(q.getChoices());
            if (shuffleChoices) Collections.shuffle(choices);
            result.put(q.getId(), choices);
        }
        return result;
    }

    private String buildSnapshot(List<Question> questions,
                                  Map<UUID, List<QuestionChoice>> shuffledChoicesMap) {
        Map<String, Object> snapshot = new HashMap<>();
        for (Question q : questions) {
            List<QuestionChoice> choices = shuffledChoicesMap.get(q.getId());

            UUID correctId = choices.stream()
                    .filter(QuestionChoice::getIsCorrect)
                    .map(QuestionChoice::getId)
                    .findFirst().orElse(null);

            List<Map<String, Object>> choiceList = choices.stream().map(c -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", c.getId().toString());
                m.put("content", c.getContent());
                m.put("isCorrect", c.getIsCorrect());
                m.put("position", c.getPosition());
                return m;
            }).collect(Collectors.toList());

            Map<String, Object> qMap = new HashMap<>();
            qMap.put("content", q.getContent());
            qMap.put("explanation", q.getExplanation());
            qMap.put("correctChoiceId", correctId != null ? correctId.toString() : null);
            qMap.put("choices", choiceList);
            snapshot.put(q.getId().toString(), qMap);
        }
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INTERNAL_ERROR", "Không thể tạo snapshot quiz.");
        }
    }

    private List<QuizAttemptStartResponse.QuestionForStudent> buildStudentQuestions(
            List<Question> questions, Map<UUID, List<QuestionChoice>> shuffledChoicesMap) {
        return questions.stream().map(q -> {
            List<QuestionChoice> choices = shuffledChoicesMap.get(q.getId());
            List<QuizAttemptStartResponse.ChoiceForStudent> choiceDtos = choices.stream()
                    .map(c -> new QuizAttemptStartResponse.ChoiceForStudent(
                            c.getId(), c.getContent(), c.getPosition()))
                    .toList();
            return new QuizAttemptStartResponse.QuestionForStudent(
                    q.getId(), q.getContent(), q.getType(), choiceDtos);
        }).toList();
    }

    @SuppressWarnings("unchecked")
    private Map<UUID, SnapshotQuestion> deserializeSnapshot(String json) {
        try {
            Map<String, Object> raw = objectMapper.readValue(json, Map.class);
            Map<UUID, SnapshotQuestion> result = new HashMap<>();
            for (Map.Entry<String, Object> entry : raw.entrySet()) {
                UUID qId = UUID.fromString(entry.getKey());
                Map<String, Object> q = (Map<String, Object>) entry.getValue();
                String correctIdStr = (String) q.get("correctChoiceId");
                UUID correctId = correctIdStr != null ? UUID.fromString(correctIdStr) : null;
                result.put(qId, new SnapshotQuestion(
                        (String) q.get("content"),
                        (String) q.get("explanation"),
                        correctId, List.of()));
            }
            return result;
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR", "Không thể đọc snapshot quiz.");
        }
    }

    private String serializeAnswers(Map<UUID, UUID> answers) {
        if (answers == null) return "{}";
        Map<String, String> strMap = new HashMap<>();
        answers.forEach((k, v) -> strMap.put(k.toString(), v != null ? v.toString() : null));
        try {
            return objectMapper.writeValueAsString(strMap);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<UUID, UUID> deserializeAnswers(String json) {
        if (json == null) return Map.of();
        try {
            Map<String, String> raw = objectMapper.readValue(json, Map.class);
            Map<UUID, UUID> result = new HashMap<>();
            raw.forEach((k, v) -> result.put(
                    UUID.fromString(k), v != null ? UUID.fromString(v) : null));
            return result;
        } catch (Exception e) {
            return Map.of();
        }
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private com.beeacademy.backend.model.Chapter loadChapterRef(UUID chapterId) {
        return chapterRepository.findById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
    }
}
