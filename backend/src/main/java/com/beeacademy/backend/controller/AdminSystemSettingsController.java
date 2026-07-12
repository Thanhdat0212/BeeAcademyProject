package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.UpdateSystemSettingsRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.SystemSettingsResponse;
import com.beeacademy.backend.service.SystemSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/system-settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminSystemSettingsController {

    private final SystemSettingsService settingsService;

    @GetMapping
    public ApiResponse<SystemSettingsResponse> getSettings() {
        return ApiResponse.ok(settingsService.getSettings());
    }

    @PutMapping
    public ApiResponse<SystemSettingsResponse> updateSettings(@Valid @RequestBody UpdateSystemSettingsRequest request) {
        return ApiResponse.ok(settingsService.updateSettings(request), "Đã cập nhật cấu hình hệ thống");
    }
}
