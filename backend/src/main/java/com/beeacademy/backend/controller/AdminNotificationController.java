package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.BroadcastNotificationRequest;
import com.beeacademy.backend.dto.response.AdminNotificationResponse;
import com.beeacademy.backend.dto.response.AdminNotificationSummaryResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.BroadcastNotificationResponse;
import com.beeacademy.backend.service.AdminNotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminNotificationController {

    private final AdminNotificationService notificationService;

    @GetMapping
    public ApiResponse<AdminNotificationSummaryResponse> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return ApiResponse.ok(notificationService.list(unreadOnly));
    }

    @PatchMapping("/{notificationId}/read")
    public ApiResponse<AdminNotificationResponse> markRead(@PathVariable UUID notificationId) {
        return ApiResponse.ok(notificationService.markRead(notificationId));
    }

    @PostMapping("/broadcast")
    public ApiResponse<BroadcastNotificationResponse> broadcast(
            @Valid @RequestBody BroadcastNotificationRequest request) {
        return ApiResponse.ok(notificationService.broadcast(request), "Đã gửi thông báo");
    }
}
