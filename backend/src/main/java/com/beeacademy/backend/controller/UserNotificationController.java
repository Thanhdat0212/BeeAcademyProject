package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.UserNotificationResponse;
import com.beeacademy.backend.dto.response.UserNotificationSummaryResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class UserNotificationController {

    private final UserNotificationService notificationService;

    @GetMapping
    public ApiResponse<UserNotificationSummaryResponse> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return ApiResponse.ok(notificationService.list(CurrentUser.required().userId(), unreadOnly));
    }

    @PatchMapping("/{notificationId}/read")
    public ApiResponse<UserNotificationResponse> markRead(@PathVariable UUID notificationId) {
        return ApiResponse.ok(notificationService.markRead(CurrentUser.required().userId(), notificationId));
    }
}
