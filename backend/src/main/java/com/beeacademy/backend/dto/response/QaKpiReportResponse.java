package com.beeacademy.backend.dto.response;

public record QaKpiReportResponse(
        long totalAnswered,
        long answeredWithin48Hours,
        long answeredWithin7Days,
        double within48HoursRate,
        double within7DaysRate
) {
}
