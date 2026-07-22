package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ScannedQuestion;
import com.beeacademy.backend.exception.BusinessException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Gọi Gemini API phía server để trích xuất câu hỏi từ PDF.
 *
 * <p>API key ({@code GEMINI_API_KEY}) chỉ tồn tại ở backend — không bao giờ
 * được bundle vào JS client-side. Frontend gửi file PDF, backend gọi Gemini
 * và trả về raw text để frontend parse.
 *
 * <p>Sau khi Gemini trả JSON câu hỏi dạng chữ, {@code scanPdf} thử ghép thêm ảnh nhúng
 * trong chính file PDF vào đúng câu hỏi ({@link PdfQuestionImageService}) trước khi trả
 * về — vẫn giữ nguyên contract trả về String JSON để không phá luồng parse phía frontend.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiScanService {

    private static final Pattern JSON_ARRAY_PATTERN = Pattern.compile("\\[[\\s\\S]*]");

    private static final Duration GEMINI_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    // Đọc cả file PDF nhiều trang lâu hơn hẳn call text thuần nên nới rộng hơn.
    private static final Duration GEMINI_PDF_TIMEOUT = Duration.ofSeconds(120);
    private static final Duration GEMINI_TEXT_TIMEOUT = Duration.ofSeconds(60);

    // HttpClient immutable + thread-safe — dùng chung 1 instance thay vì tạo mỗi lần gọi.
    // Trước đây là HttpClient.newHttpClient(): không timeout nào, Gemini treo là thread treo theo.
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(GEMINI_CONNECT_TIMEOUT)
            .build();

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    private final PdfQuestionImageService pdfQuestionImageService;
    private final ObjectMapper scanObjectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private static final long MAX_PDF_SIZE_BYTES = 20L * 1024 * 1024; // 20 MB

    private static final String EXTRACT_PROMPT = """
            Đây là tài liệu chứa câu hỏi thi/kiểm tra/bài tập. Hãy trích xuất TẤT CẢ câu hỏi và trả về một JSON array thuần (không có markdown, không có giải thích thêm).

            Định dạng mỗi phần tử:
            {
              "content": "Nội dung câu hỏi (giữ nguyên, không chỉnh sửa)",
              "type": "multiple_choice" hoặc "true_false",
              "difficulty": "easy" hoặc "medium" hoặc "hard",
              "choices": [
                { "content": "Nội dung đáp án", "isCorrect": true },
                { "content": "Nội dung đáp án", "isCorrect": false }
              ],
              "explanation": "Giải thích nếu có trong tài liệu, hoặc null"
            }

            Quy tắc quan trọng:
            - type = "true_false" CHỈ khi câu hỏi có đúng 2 đáp án Đúng/Sai
            - type = "multiple_choice" cho câu hỏi có 2-4 lựa chọn A/B/C/D
            - Mỗi câu phải có ĐÚNG 1 phần tử isCorrect: true
            - difficulty dựa vào mức độ phức tạp của câu hỏi
            - Nếu không xác định được đáp án đúng, đặt đáp án đầu tiên là đúng
            - Chỉ trả về JSON array, bắt đầu bằng [ và kết thúc bằng ]""";

    /**
     * Upload PDF lên Gemini, nhận về raw text chứa JSON array câu hỏi — sau đó thử ghép thêm
     * ảnh nhúng trong chính PDF vào đúng câu hỏi trước khi trả về (best-effort, xem
     * {@link PdfQuestionImageService}). Frontend vẫn tự parse raw text như cũ
     * (giữ nguyên logic {@code parseGeminiResponse}), chỉ là JSON giờ có thể có thêm
     * {@code promptAssetUrl}/{@code imageUrl}.
     *
     * @param file file PDF (tối đa 20 MB)
     * @return raw text (JSON array, có thể kèm text thừa nếu Gemini trả không sạch)
     */
    public String scanPdf(MultipartFile file, UUID teacherId) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new BusinessException("GEMINI_NOT_CONFIGURED",
                    "Tính năng AI Scan chưa được cấu hình trên server. "
                    + "Vui lòng liên hệ quản trị viên.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }

        if (file.isEmpty()) {
            throw new BusinessException("INVALID_FILE", "File PDF không được để trống.",
                    HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > MAX_PDF_SIZE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File PDF tối đa 20 MB.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.toLowerCase().endsWith(".pdf")) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ hỗ trợ file PDF.", HttpStatus.BAD_REQUEST);
        }

        try {
            String base64Data = Base64.getEncoder().encodeToString(file.getBytes());

            ObjectMapper mapper = new ObjectMapper();
            String requestBody = mapper.writeValueAsString(Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(
                                    Map.of("inline_data", Map.of(
                                            "mime_type", "application/pdf",
                                            "data", base64Data
                                    )),
                                    Map.of("text", EXTRACT_PROMPT)
                            )
                    ))
            ));

            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + geminiModel + ":generateContent?key=" + geminiApiKey;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(GEMINI_PDF_TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 400) {
                log.error("Gemini API 400 (key sai hoặc model không hỗ trợ): {}", response.body());
                throw new BusinessException("GEMINI_API_ERROR",
                        "API key không hợp lệ hoặc model không được hỗ trợ.",
                        HttpStatus.BAD_GATEWAY);
            }
            if (response.statusCode() != 200) {
                log.error("Gemini API trả lỗi {}: {}", response.statusCode(), response.body());
                throw new BusinessException("GEMINI_API_ERROR",
                        "Gemini API trả về lỗi " + response.statusCode() + ". Thử lại sau.",
                        HttpStatus.BAD_GATEWAY);
            }

            // Trích text từ response: candidates[0].content.parts[0].text
            @SuppressWarnings("unchecked")
            Map<String, Object> responseMap = mapper.readValue(response.body(), Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> candidates =
                    (List<Map<String, Object>>) responseMap.get("candidates");
            @SuppressWarnings("unchecked")
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            String rawText = (String) parts.get(0).get("text");

            log.info("AI Scan hoàn tất — {} ký tự trả về từ Gemini ({})",
                    rawText.length(), geminiModel);
            return attachImagesIfPossible(rawText, file.getBytes(), teacherId);

        } catch (BusinessException e) {
            throw e;
        } catch (HttpTimeoutException e) {
            log.error("Gemini khong tra loi trong {}s khi scan PDF", GEMINI_PDF_TIMEOUT.toSeconds());
            throw new BusinessException("AI_SCAN_TIMEOUT",
                    "AI xử lý quá lâu nên đã dừng. Thử lại với file PDF ít trang hơn.",
                    HttpStatus.GATEWAY_TIMEOUT);
        } catch (Exception e) {
            log.error("Lỗi khi gọi Gemini AI", e);
            throw new BusinessException("AI_SCAN_FAILED",
                    "Không thể xử lý PDF: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Parse rawText thành danh sách câu hỏi, ghép ảnh nhúng trong PDF vào đúng câu, rồi
     * serialize lại thành JSON string trả cho frontend. Bất kỳ bước nào lỗi (Gemini trả JSON
     * không sạch, PDF không đọc được ảnh...) đều fallback về đúng rawText gốc — ghép ảnh chỉ
     * là phần cộng thêm, không được phép chặn kết quả scan chữ đã có.
     */
    private String attachImagesIfPossible(String rawText, byte[] pdfBytes, UUID teacherId) {
        try {
            Matcher matcher = JSON_ARRAY_PATTERN.matcher(rawText);
            if (!matcher.find()) {
                return rawText;
            }
            List<ScannedQuestion> questions = scanObjectMapper.readValue(
                    matcher.group(), new com.fasterxml.jackson.core.type.TypeReference<List<ScannedQuestion>>() {});

            List<ScannedQuestion> enriched = pdfQuestionImageService.attachImages(pdfBytes, questions, teacherId);
            return scanObjectMapper.writeValueAsString(enriched);
        } catch (Exception e) {
            log.warn("Khong the ghep anh PDF vao ket qua AI Scan, tra ve ket qua chi co chu: {}", e.getMessage());
            return rawText;
        }
    }

    public String generateExamQuestions(String prompt, String material,
                                        Integer questionCount, String questionType,
                                        String difficulty) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new BusinessException("GEMINI_NOT_CONFIGURED",
                    "Tính năng AI tạo câu hỏi chưa được cấu hình trên server.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        String safeMaterial = material == null || material.isBlank()
                ? "(không có tài liệu bổ sung)"
                : material.trim();
        String examPrompt = """
                Tạo câu hỏi cho bài kiểm tra Bee Academy và chỉ trả về JSON array thuần.
                Schema moi phan tu:
                {
                  "text": "nội dung câu hỏi",
                  "type": "%s",
                  "options": ["A", "B", "C", "D"],
                  "correctIndices": [0],
                  "metadata": {"acceptedAnswers": ["đáp án"]},
                  "explanation": "giai thich ngan",
                  "difficulty": "%s",
                  "sourceRefs": ["trích dẫn ngắn từ tài liệu hoặc prompt"]
                }
                Quy tac:
                - Tạo đúng %d câu hỏi.
                - type phải đúng "%s"; difficulty phải đúng "%s".
                - multiple_choice/true_false phải có options và correctIndices hợp lệ.
                - fill_in_blank phải có metadata.acceptedAnswers.
                - essay phải có metadata.rubric hoặc explanation làm barem chấm.
                - Mỗi câu phải có sourceRefs; nếu không có tài liệu, dung "teacher_prompt".
                - Không auto-publish; đây là câu hỏi DRAFT để giáo viên review.
                Yêu cầu của giáo viên: %s
                Tai lieu/pham vi: %s
                """.formatted(questionType, difficulty, questionCount, questionType, difficulty,
                prompt.trim(), safeMaterial);
        return callGeminiText(examPrompt);
    }

    private String callGeminiText(String textPrompt) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            String requestBody = mapper.writeValueAsString(Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", textPrompt))
                    ))
            ));

            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + geminiModel + ":generateContent?key=" + geminiApiKey;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(GEMINI_TEXT_TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Gemini API trả lời {}: {}", response.statusCode(), response.body());
                throw new BusinessException("AI_GENERATION_FAILED",
                        "AI Engine trả về lỗi " + response.statusCode() + ".",
                        HttpStatus.BAD_GATEWAY);
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> responseMap = mapper.readValue(response.body(), Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> candidates =
                    (List<Map<String, Object>>) responseMap.get("candidates");
            @SuppressWarnings("unchecked")
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
            return (String) parts.get(0).get("text");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi gọi AI Engine", e);
            throw new BusinessException("AI_GENERATION_FAILED",
                    "Không thể tạo câu hỏi AI: " + e.getMessage(),
                    HttpStatus.BAD_GATEWAY);
        }
    }
}
