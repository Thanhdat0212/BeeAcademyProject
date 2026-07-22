package com.beeacademy.backend.dto.response;

import java.util.List;

/**
 * Câu hỏi Gemini trích ra từ PDF (AI Scan), ở dạng trung gian phía server.
 *
 * <p>Sau khi Gemini trả JSON thô, {@code AiScanService} parse vào record này để
 * {@code PdfQuestionImageService} có thể ghép thêm ảnh nhúng trích từ chính file PDF
 * (theo thứ tự xuất hiện trong file — xem {@code PdfQuestionImageService}), rồi mới
 * serialize lại thành JSON trả cho frontend. Field/tên phải khớp {@code ParsedQuestion}
 * phía frontend ({@code AIScanModal.tsx}).
 */
public record ScannedQuestion(
        String content,
        String type,
        String difficulty,
        List<ScannedChoice> choices,
        String explanation,
        String promptAssetUrl
) {
    public record ScannedChoice(String content, boolean isCorrect, String imageUrl) {
        public ScannedChoice withImageUrl(String imageUrl) {
            return new ScannedChoice(content, isCorrect, imageUrl);
        }
    }

    public ScannedQuestion withPromptAssetUrl(String promptAssetUrl) {
        boolean canBecomeImageQuestion = "multiple_choice".equals(type) || "true_false".equals(type);
        return new ScannedQuestion(
                content,
                canBecomeImageQuestion ? "image_question" : type,
                difficulty, choices, explanation, promptAssetUrl);
    }

    public ScannedQuestion withChoices(List<ScannedChoice> newChoices) {
        return new ScannedQuestion(content, "image_question", difficulty, newChoices, explanation, promptAssetUrl);
    }
}
