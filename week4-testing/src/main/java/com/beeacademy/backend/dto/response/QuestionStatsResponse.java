package com.beeacademy.backend.dto.response;

public record QuestionStatsResponse(
        int easyCount,
        int mediumCount,
        int hardCount,
        int totalActive
) {
    public int total() { return easyCount + mediumCount + hardCount; }
}
