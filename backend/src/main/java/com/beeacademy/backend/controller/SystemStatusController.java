package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.SystemStatusResponse;
import com.beeacademy.backend.service.SystemSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint public để FE kiểm tra trạng thái bảo trì kể cả khi chưa đăng nhập.
 */
@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemStatusController {

    private final SystemSettingsService settingsService;

    @GetMapping("/status")
    public ApiResponse<SystemStatusResponse> getStatus() {
        return ApiResponse.ok(new SystemStatusResponse(
                settingsService.isMaintenanceModeOn(),
                settingsService.getMaintenanceUntil()
        ));
    }
}
