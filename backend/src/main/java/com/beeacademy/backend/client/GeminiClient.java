package com.beeacademy.backend.client;

import com.beeacademy.backend.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Client dùng chung để gọi Gemini generateContent với nội dung ĐA PHƯƠNG THỨC
 * (text + inline_data ảnh/PDF). Key {@code GEMINI_API_KEY} chỉ ở backend.
 *
 * <p>Tách riêng khỏi {@code AiChatService}/{@code AiScanService} để không đụng
 * các file AI dùng chung; hai service cũ vẫn giữ nguyên cách gọi của chúng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiClient {

    @Value("${app.gemini.api-key:}")
    private String apiKey;

    @Value("${app.gemini.model:gemini-2.5-flash}")
    private String model;

    private final ObjectMapper objectMapper;

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .build();

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void requireConfigured() {
        if (!isConfigured()) {
            throw new BusinessException("GEMINI_NOT_CONFIGURED",
                    "Tính năng AI chưa được cấu hình trên server. "
                    + "Vui lòng liên hệ quản trị viên.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * Gọi Gemini với một lượt user gồm nhiều part (text và/hoặc inline_data),
     * trả về text thô từ candidate đầu tiên.
     *
     * @param systemPrompt system_instruction, có thể null
     * @param parts        danh sách part, mỗi part là {@code {"text": ...}}
     *                     hoặc {@code {"inline_data": {"mime_type", "data"(base64)}}}
     */
    public String generate(String systemPrompt, List<Map<String, Object>> parts) {
        requireConfigured();
        try {
            List<Map<String, Object>> contents = List.of(Map.of("role", "user", "parts", parts));
            Map<String, Object> body = systemPrompt != null && !systemPrompt.isBlank()
                    ? Map.of(
                            "system_instruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                            "contents", contents)
                    : Map.of("contents", contents);
            String requestBody = objectMapper.writeValueAsString(body);

            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + model + ":generateContent?key=" + apiKey;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(REQUEST_TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Gemini API trả lỗi {}: {}", response.statusCode(), response.body());
                throw new BusinessException("GEMINI_API_ERROR",
                        "Trợ lý AI đang gặp sự cố, thử lại sau.", HttpStatus.BAD_GATEWAY);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> responseMap = objectMapper.readValue(response.body(), Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> candidates =
                    (List<Map<String, Object>>) responseMap.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                throw new BusinessException("GEMINI_API_ERROR",
                        "Trợ lý AI không trả về nội dung, thử lại sau.", HttpStatus.BAD_GATEWAY);
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> respParts = (List<Map<String, Object>>) content.get("parts");
            return (String) respParts.get(0).get("text");

        } catch (BusinessException e) {
            throw e;
        } catch (HttpTimeoutException e) {
            log.error("Gemini API timeout sau {}s", REQUEST_TIMEOUT.toSeconds(), e);
            throw new BusinessException("GEMINI_TIMEOUT",
                    "Trợ lý AI phản hồi quá lâu, vui lòng thử lại sau ít phút.",
                    HttpStatus.GATEWAY_TIMEOUT);
        } catch (Exception e) {
            log.error("Lỗi khi gọi Gemini AI", e);
            throw new BusinessException("AI_CALL_FAILED",
                    "Không thể kết nối trợ lý AI, thử lại sau.",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
