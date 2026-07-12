package com.beeacademy.backend.dto.response;

import java.util.List;

public record UserNotificationSummaryResponse(
        long unreadCount,
        List<UserNotificationResponse> notifications
) {
}
