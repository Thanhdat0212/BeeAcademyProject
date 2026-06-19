package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.service.AiScanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * AI Scan — trích xuất câu hỏi từ PDF qua Gemini (server-side).
 *
 * <p>API key Gemini chỉ tồn tại ở backend ({@code GEMINI_API_KEY} trong .env),
 * KHÔNG bao giờ được expose ra client. Frontend upload file PDF, backend gọi
 * Gemini và trả về raw text để frontend parse thành danh sách câu hỏi.
 */
@RestController
@RequestMapping("/api/teacher/ai")
@RequiredArgsConstructor
public class AiScanController {

    private final AiScanService aiScanService;

    /**
     * Upload PDF → Gemini → trả raw text (JSON array câu hỏi).
     *
     * @param file file PDF tối đa 20 MB
     * @return raw text từ Gemini để frontend parse
     */
    @PostMapping(value = "/scan-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('teacher')")
    public ResponseEntity<ApiResponse<String>> scanPdf(
            @RequestParam("file") MultipartFile file) {
        String rawText = aiScanService.scanPdf(file);
        return ResponseEntity.ok(ApiResponse.ok(rawText));
    }
}
