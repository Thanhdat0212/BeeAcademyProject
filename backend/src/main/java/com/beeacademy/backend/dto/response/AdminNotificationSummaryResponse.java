package com.beeacademy.backend.dto.response;

import java.util.List;

public record AdminNotificationSummaryResponse(
        long unreadCount,
        List<AdminNotificationResponse> notifications
) {}
