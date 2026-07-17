package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Kết quả AI phân tích một lượt làm quiz. Quiz đã chấm tự động nên AI
 * KHÔNG đưa điểm — chỉ nhận xét, điểm mạnh/cần cải thiện và gợi ý ôn tập.
 */
public record AiQuizAnalysisResponse(
        UUID attemptId,
        String overallComment,
        List<String> strengths,
        List<String> improvements,
        List<String> studySuggestions,
        Instant aiGradedAt,
        String disclaimer
) {
}
