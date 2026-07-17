package com.beeacademy.backend.service;

import com.beeacademy.backend.client.GeminiClient;
import com.beeacademy.backend.dto.request.SubmitExamRequest;
import com.beeacademy.backend.dto.response.AiExamGradeResponse;
import com.beeacademy.backend.dto.response.AiQuizAnalysisResponse;
import com.beeacademy.backend.dto.response.QuizResultResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * AI chấm/nhận xét sơ bộ bài làm của học sinh TRƯỚC khi giáo viên chấm chính thức.
 *
 * <ul>
 *   <li><b>Exam</b>: AI chấm điểm phần tự luận (đọc cả ảnh viết tay qua Gemini vision),
 *       backend cộng với điểm trắc nghiệm đã chấm tự động → điểm % sơ bộ.</li>
 *   <li><b>Quiz</b>: đã chấm tự động nên AI chỉ nhận xét/gợi ý, không đưa điểm.</li>
 * </ul>
 *
 * <p>Gọi Gemini <b>một lần/lượt</b> rồi lưu kết quả (idempotent) — lần sau trả bản đã lưu.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiGradingService {

    private final ExamAttemptRepository examAttemptRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final QuizService quizService;
    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    private static final Set<String> MANUAL_EXAM_TYPES = Set.of(
            "essay", "essay_short", "essay_long", "file_upload");
    private static final double EXAM_TOTAL_POINTS = 10.0;
    private static final int MAX_IMAGES = 4;
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;

    private static final String DISCLAIMER =
            "Điểm và nhận xét do AI đưa ra chỉ mang tính tham khảo, dựa trên barem của giáo viên. "
            + "Điểm chính thức sẽ do giáo viên xác nhận.";

    private static final HttpClient IMAGE_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String EXAM_SYSTEM_PROMPT = """
            Bạn là giáo viên THCS (lớp 6-9) chấm bài kiểm tra một cách công tâm, bám sát barem.
            Chấm điểm phần tự luận dựa trên: mức độ đúng của lập luận/kết quả, cách trình bày,
            và sự khớp với barem/đáp án mẫu được cung cấp. Với câu nộp bằng ảnh, hãy đọc kỹ chữ
            viết tay trong ảnh. Cho điểm hợp lý theo thang điểm tối đa của từng câu, không cho cao
            hơn điểm tối đa. Nhận xét ngắn gọn, khích lệ, chỉ ra chỗ được và chỗ cần sửa.""";

    private static final String QUIZ_SYSTEM_PROMPT = """
            Bạn là gia sư THCS (lớp 6-9) thân thiện. Học sinh vừa làm xong một bài quiz trắc nghiệm
            đã được chấm điểm tự động. Nhiệm vụ của bạn là PHÂN TÍCH bài làm để giúp em học tốt hơn:
            chỉ ra em nắm chắc phần nào, sai ở đâu và nên ôn lại gì. TUYỆT ĐỐI không đưa ra điểm số.""";

    // ========================================================================
    // Exam — AI chấm sơ bộ
    // ========================================================================

    @Transactional
    public AiExamGradeResponse gradeExamAttempt(UUID attemptId, AuthenticatedUser me) {
        ExamAttempt attempt = examAttemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", attemptId));
        if (attempt.getSubmittedAt() == null) {
            throw new BusinessException("EXAM_NOT_SUBMITTED",
                    "Bài kiểm tra chưa được nộp nên chưa thể nhờ AI chấm.");
        }
        if (attempt.getAiGradedAt() != null) {
            return toExamResponse(attempt);
        }
        geminiClient.requireConfigured();

        List<SnapshotExamQuestion> questions = readSnapshotQuestions(attempt.getQuestionsSnapshot());
        Map<String, SubmitExamRequest.ExamAnswerRequest> answers = readExamAnswers(attempt.getAnswers());
        List<SnapshotExamQuestion> essays = questions.stream()
                .filter(q -> MANUAL_EXAM_TYPES.contains(q.type()))
                .toList();
        if (essays.isEmpty()) {
            throw new BusinessException("NO_ESSAY_TO_GRADE",
                    "Bài kiểm tra này không có phần tự luận để AI chấm.");
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(textPart(
                "Hãy chấm các câu tự luận dưới đây. Với mỗi câu, trả về điểm đạt được và nhận xét."));
        int imageBudget = MAX_IMAGES;
        for (int i = 0; i < essays.size(); i++) {
            SnapshotExamQuestion q = essays.get(i);
            SubmitExamRequest.ExamAnswerRequest ans = answers.get(q.id());
            parts.add(textPart(buildEssayBlock(i + 1, q, ans)));
            imageBudget = attachImages(parts, i + 1, ans, imageBudget);
        }
        parts.add(textPart(examOutputSpec(essays.size())));

        JsonNode root = extractJsonObject(geminiClient.generate(EXAM_SYSTEM_PROMPT, parts));
        Map<Integer, JsonNode> byIndex = indexAiQuestions(root.path("questions"));

        List<AiExamGradeResponse.QuestionGrade> grades = new ArrayList<>();
        double essayEarned = 0.0;
        for (int i = 0; i < essays.size(); i++) {
            SnapshotExamQuestion q = essays.get(i);
            SubmitExamRequest.ExamAnswerRequest ans = answers.get(q.id());
            double maxPoints = q.points() != null ? q.points() : 0.0;
            JsonNode aiNode = byIndex.get(i + 1);

            double earned = clamp(aiNode != null ? aiNode.path("earnedPoints").asDouble(0.0) : 0.0,
                    0.0, maxPoints);
            String comment = aiNode != null && !aiNode.path("comment").asText("").isBlank()
                    ? aiNode.path("comment").asText().trim()
                    : "AI chưa đưa được nhận xét cho câu này.";
            List<String> suggestions = readStringArray(aiNode != null ? aiNode.path("suggestions") : null);
            essayEarned += earned;

            grades.add(new AiExamGradeResponse.QuestionGrade(
                    q.id(),
                    q.text(),
                    q.type(),
                    round1(earned),
                    round1(maxPoints),
                    ans != null ? trimToNull(ans.textAnswer()) : null,
                    ans != null ? normalizeImageUrls(ans.imageUrls()) : List.of(),
                    comment,
                    suggestions));
        }

        double totalPoints = questions.stream()
                .map(SnapshotExamQuestion::points)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();
        if (totalPoints <= 0.0) {
            totalPoints = EXAM_TOTAL_POINTS;
        }
        double objectivePercent = attempt.getScorePercent() != null
                ? attempt.getScorePercent().doubleValue()
                : 0.0;
        double essayPercent = essayEarned / totalPoints * 100.0;
        double aiScorePercent = Math.min(100.0, round1(objectivePercent + essayPercent));

        String overallComment = trimOrDefault(root.path("overallComment").asText(""),
                "AI đã chấm sơ bộ phần tự luận của em.");
        List<String> strengths = readStringArray(root.path("strengths"));
        List<String> improvements = readStringArray(root.path("improvements"));

        attempt.applyAiGrade(aiScorePercent,
                toJson(new StoredExamFeedback(overallComment, strengths, improvements, grades)));
        examAttemptRepository.save(attempt);
        log.info("AI chấm sơ bộ exam attempt {} — {}% (student {})",
                attemptId, aiScorePercent, me.userId());

        return new AiExamGradeResponse(attempt.getId(), aiScorePercent, overallComment,
                strengths, improvements, grades, attempt.getAiGradedAt(), DISCLAIMER);
    }

    @Transactional(readOnly = true)
    public AiExamGradeResponse getExamGrade(UUID attemptId, AuthenticatedUser me) {
        ExamAttempt attempt = examAttemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", attemptId));
        return attempt.getAiGradedAt() == null ? null : toExamResponse(attempt);
    }

    private AiExamGradeResponse toExamResponse(ExamAttempt attempt) {
        StoredExamFeedback stored = readStoredExam(attempt.getAiFeedback());
        Double score = attempt.getAiScorePercent() != null
                ? attempt.getAiScorePercent().doubleValue()
                : null;
        return new AiExamGradeResponse(
                attempt.getId(),
                score,
                stored.overallComment(),
                stored.strengths() != null ? stored.strengths() : List.of(),
                stored.improvements() != null ? stored.improvements() : List.of(),
                stored.questions() != null ? stored.questions() : List.of(),
                attempt.getAiGradedAt(),
                DISCLAIMER);
    }

    // ========================================================================
    // Quiz — AI phân tích (không đưa điểm)
    // ========================================================================

    @Transactional
    public AiQuizAnalysisResponse analyzeQuizAttempt(UUID attemptId, AuthenticatedUser me) {
        QuizAttempt attempt = quizAttemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("QuizAttempt", attemptId));
        if (attempt.getSubmittedAt() == null) {
            throw new BusinessException("QUIZ_NOT_SUBMITTED",
                    "Bài quiz chưa được nộp nên chưa thể nhờ AI phân tích.");
        }
        if (attempt.getAiGradedAt() != null) {
            return toQuizResponse(attempt);
        }
        geminiClient.requireConfigured();

        QuizResultResponse result = quizService.getResult(attemptId, me);
        String prompt = buildQuizPrompt(result);

        JsonNode root = extractJsonObject(
                geminiClient.generate(QUIZ_SYSTEM_PROMPT, List.of(textPart(prompt))));

        String overallComment = trimOrDefault(root.path("overallComment").asText(""),
                "AI đã phân tích bài quiz của em.");
        List<String> strengths = readStringArray(root.path("strengths"));
        List<String> improvements = readStringArray(root.path("improvements"));
        List<String> studySuggestions = readStringArray(root.path("studySuggestions"));

        attempt.applyAiAnalysis(
                toJson(new StoredQuizFeedback(overallComment, strengths, improvements, studySuggestions)));
        quizAttemptRepository.save(attempt);
        log.info("AI phân tích quiz attempt {} (student {})", attemptId, me.userId());

        return new AiQuizAnalysisResponse(attempt.getId(), overallComment, strengths,
                improvements, studySuggestions, attempt.getAiGradedAt(), DISCLAIMER);
    }

    @Transactional(readOnly = true)
    public AiQuizAnalysisResponse getQuizAnalysis(UUID attemptId, AuthenticatedUser me) {
        QuizAttempt attempt = quizAttemptRepository.findByIdAndStudentId(attemptId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("QuizAttempt", attemptId));
        return attempt.getAiGradedAt() == null ? null : toQuizResponse(attempt);
    }

    private AiQuizAnalysisResponse toQuizResponse(QuizAttempt attempt) {
        StoredQuizFeedback stored = readStoredQuiz(attempt.getAiFeedback());
        return new AiQuizAnalysisResponse(
                attempt.getId(),
                stored.overallComment(),
                stored.strengths() != null ? stored.strengths() : List.of(),
                stored.improvements() != null ? stored.improvements() : List.of(),
                stored.studySuggestions() != null ? stored.studySuggestions() : List.of(),
                attempt.getAiGradedAt(),
                DISCLAIMER);
    }

    // ========================================================================
    // Prompt builders
    // ========================================================================

    private String buildEssayBlock(int index, SnapshotExamQuestion q,
                                   SubmitExamRequest.ExamAnswerRequest ans) {
        StringBuilder sb = new StringBuilder();
        double maxPoints = q.points() != null ? q.points() : 0.0;
        sb.append("\n--- Câu ").append(index)
                .append(" (loại: ").append(q.type())
                .append(", điểm tối đa: ").append(round1(maxPoints)).append(") ---\n");
        sb.append("Đề bài: ").append(nullToDash(q.text())).append("\n");
        sb.append("Barem/đáp án mẫu: ").append(rubricOf(q)).append("\n");

        String textAnswer = ans != null ? trimToNull(ans.textAnswer()) : null;
        List<String> images = ans != null ? normalizeImageUrls(ans.imageUrls()) : List.of();
        if (textAnswer != null) {
            sb.append("Bài làm (chữ) của học sinh: ").append(textAnswer).append("\n");
        } else if (images.isEmpty()) {
            sb.append("Bài làm: học sinh không trả lời câu này.\n");
        } else {
            sb.append("Bài làm: học sinh nộp bằng ảnh (xem ảnh đính kèm ngay dưới).\n");
        }
        return sb.toString();
    }

    private String rubricOf(SnapshotExamQuestion q) {
        JsonNode meta = q.metadata();
        if (meta != null) {
            String rubric = meta.path("rubric").asText("");
            if (!rubric.isBlank()) return rubric.trim();
            String sample = meta.path("sampleAnswer").asText("");
            if (!sample.isBlank()) return sample.trim();
        }
        if (q.explanation() != null && !q.explanation().isBlank()) {
            return q.explanation().trim();
        }
        return "(không có barem — hãy chấm theo kiến thức chuẩn THCS)";
    }

    private String examOutputSpec(int essayCount) {
        return """
                \nHãy trả về DUY NHẤT một JSON object (không markdown, không giải thích thêm) theo đúng định dạng:
                {
                  "questions": [
                    {"index": 1, "earnedPoints": 1.5, "comment": "nhận xét ngắn", "suggestions": ["gợi ý sửa"]}
                  ],
                  "strengths": ["điểm mạnh 1", "điểm mạnh 2"],
                  "improvements": ["điểm cần cải thiện 1", "điểm cần cải thiện 2"],
                  "overallComment": "nhận xét tổng quan 1-2 câu"
                }
                Quy tắc:
                - Mảng questions có đúng %d phần tử, index từ 1 đến %d khớp số câu ở trên.
                - earnedPoints là số điểm đạt được, không vượt quá điểm tối đa của câu đó.
                - Viết toàn bộ bằng tiếng Việt, giọng khích lệ phù hợp học sinh THCS.
                """.formatted(essayCount, essayCount);
    }

    private String buildQuizPrompt(QuizResultResponse result) {
        StringBuilder sb = new StringBuilder();
        sb.append("Học sinh đạt ").append(result.score()).append("/10 (")
                .append(result.correctCount()).append("/").append(result.totalCount())
                .append(" câu đúng). Chi tiết từng câu:\n");
        int i = 1;
        for (QuizResultResponse.QuestionResult d : result.details()) {
            sb.append("\nCâu ").append(i++).append(": ").append(nullToDash(d.content())).append("\n");
            sb.append("- Học sinh chọn: ").append(nullToDash(d.studentAnswerText())).append("\n");
            sb.append("- Đáp án đúng: ").append(nullToDash(d.correctAnswerText())).append("\n");
            sb.append("- Kết quả: ").append(Boolean.TRUE.equals(d.isCorrect()) ? "ĐÚNG" : "SAI").append("\n");
            if (d.explanation() != null && !d.explanation().isBlank()) {
                sb.append("- Giải thích: ").append(d.explanation().trim()).append("\n");
            }
        }
        sb.append("""
                \nHãy trả về DUY NHẤT một JSON object (không markdown) theo định dạng:
                {
                  "overallComment": "nhận xét tổng quan 2-3 câu",
                  "strengths": ["điểm mạnh 1", "điểm mạnh 2"],
                  "improvements": ["điểm cần cải thiện 1", "điểm cần cải thiện 2"],
                  "studySuggestions": ["gợi ý ôn tập cụ thể 1", "gợi ý ôn tập 2"]
                }
                Viết toàn bộ bằng tiếng Việt, giọng khích lệ. KHÔNG nhắc lại điểm số.""");
        return sb.toString();
    }

    // ========================================================================
    // Image (vision)
    // ========================================================================

    private int attachImages(List<Map<String, Object>> parts, int questionIndex,
                             SubmitExamRequest.ExamAnswerRequest ans, int budget) {
        if (ans == null || ans.imageUrls() == null) {
            return budget;
        }
        for (String url : normalizeImageUrls(ans.imageUrls())) {
            if (budget <= 0) {
                break;
            }
            String mime = visionMimeOf(url);
            if (mime == null) {
                parts.add(textPart("[Câu " + questionIndex
                        + ": có tệp đính kèm nhưng AI không đọc được định dạng này — bỏ qua.]"));
                continue;
            }
            String base64 = fetchImageBase64(url);
            if (base64 == null) {
                continue;
            }
            parts.add(textPart("[Ảnh bài làm của học sinh cho Câu " + questionIndex + "]"));
            parts.add(Map.of("inline_data", Map.of("mime_type", mime, "data", base64)));
            budget--;
        }
        return budget;
    }

    private String visionMimeOf(String url) {
        String lower = url.toLowerCase();
        int q = lower.indexOf('?');
        if (q >= 0) {
            lower = lower.substring(0, q);
        }
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".pdf")) return "application/pdf";
        return null;
    }

    private String fetchImageBase64(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();
            HttpResponse<byte[]> response = IMAGE_CLIENT.send(request,
                    HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                log.warn("Không tải được ảnh bài làm ({}): HTTP {}", url, response.statusCode());
                return null;
            }
            byte[] body = response.body();
            if (body == null || body.length == 0 || body.length > MAX_IMAGE_BYTES) {
                log.warn("Ảnh bài làm rỗng hoặc quá lớn ({} bytes): {}",
                        body == null ? 0 : body.length, url);
                return null;
            }
            return Base64.getEncoder().encodeToString(body);
        } catch (Exception e) {
            log.warn("Lỗi tải ảnh bài làm {}: {}", url, e.getMessage());
            return null;
        }
    }

    // ========================================================================
    // JSON helpers
    // ========================================================================

    private List<SnapshotExamQuestion> readSnapshotQuestions(String json) {
        try {
            return readJsonValue(json, new TypeReference<List<SnapshotExamQuestion>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR", "Không thể đọc bài kiểm tra.");
        }
    }

    private Map<String, SubmitExamRequest.ExamAnswerRequest> readExamAnswers(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return readJsonValue(json,
                    new TypeReference<Map<String, SubmitExamRequest.ExamAnswerRequest>>() {});
        } catch (Exception e) {
            throw new BusinessException("INTERNAL_ERROR", "Không thể đọc đáp án bài kiểm tra.");
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

    private JsonNode extractJsonObject(String raw) {
        if (raw == null) {
            throw aiSchemaError();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw aiSchemaError();
        }
        try {
            return objectMapper.readTree(raw.substring(start, end + 1));
        } catch (Exception e) {
            throw aiSchemaError();
        }
    }

    private BusinessException aiSchemaError() {
        return new BusinessException("AI_SCHEMA_INVALID",
                "AI trả về kết quả không đúng định dạng, vui lòng thử lại.",
                HttpStatus.BAD_GATEWAY);
    }

    private Map<Integer, JsonNode> indexAiQuestions(JsonNode questions) {
        Map<Integer, JsonNode> map = new HashMap<>();
        if (questions != null && questions.isArray()) {
            for (JsonNode node : questions) {
                if (node.path("index").canConvertToInt()) {
                    map.putIfAbsent(node.path("index").asInt(), node);
                }
            }
        }
        return map;
    }

    private List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String value = item.asText("").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private List<String> normalizeImageUrls(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(v -> !v.isBlank())
                .distinct()
                .limit(10)
                .toList();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INTERNAL_ERROR", "Không thể lưu nhận xét AI.");
        }
    }

    private StoredExamFeedback readStoredExam(String json) {
        try {
            return readJsonValue(json, new TypeReference<StoredExamFeedback>() {});
        } catch (Exception e) {
            return new StoredExamFeedback("", List.of(), List.of(), List.of());
        }
    }

    private StoredQuizFeedback readStoredQuiz(String json) {
        try {
            return readJsonValue(json, new TypeReference<StoredQuizFeedback>() {});
        } catch (Exception e) {
            return new StoredQuizFeedback("", List.of(), List.of(), List.of());
        }
    }

    // ========================================================================
    // Small utils
    // ========================================================================

    private Map<String, Object> textPart(String text) {
        return Map.of("text", text);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trimOrDefault(String value, String fallback) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isBlank() ? fallback : trimmed;
    }

    private String nullToDash(String value) {
        return value == null || value.isBlank() ? "(không có)" : value.trim();
    }

    // ========================================================================
    // Snapshot + stored records
    // ========================================================================

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

    private record StoredExamFeedback(
            String overallComment,
            List<String> strengths,
            List<String> improvements,
            List<AiExamGradeResponse.QuestionGrade> questions
    ) {}

    private record StoredQuizFeedback(
            String overallComment,
            List<String> strengths,
            List<String> improvements,
            List<String> studySuggestions
    ) {}
}
