package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Gọi Gemini API phía server để trích xuất câu hỏi từ PDF.
 *
 * <p>API key ({@code GEMINI_API_KEY}) chỉ tồn tại ở backend — không bao giờ
 * được bundle vào JS client-side. Frontend gửi file PDF, backend gọi Gemini
 * và trả về raw text để frontend parse.
 */
@Slf4j
@Service
public class AiScanService {

    @Value("${app.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${app.gemini.model:gemini-2.0-flash}")
    private String geminiModel;

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
     * Upload PDF lên Gemini, nhận về raw text chứa JSON array câu hỏi.
     * Frontend tự parse raw text (giữ nguyên logic parseGeminiResponse).
     *
     * @param file file PDF (tối đa 20 MB)
     * @return raw text từ Gemini (JSON array hoặc có thể kèm text thừa)
     */
    public String scanPdf(MultipartFile file) {
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

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = client.send(request,
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
            return rawText;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi gọi Gemini AI", e);
            throw new BusinessException("AI_SCAN_FAILED",
                    "Không thể xử lý PDF: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
