package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.UpdateSystemSettingsRequest;
import com.beeacademy.backend.dto.response.SystemSettingsResponse;
import com.beeacademy.backend.model.SystemSettings;
import com.beeacademy.backend.repository.SystemSettingsRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Cấu hình hệ thống single-row (phí nền tảng, chế độ bảo trì).
 *
 * <p>{@code maintenanceModeCache} giữ giá trị maintenance mode trong bộ nhớ
 * để {@code MaintenanceModeFilter} kiểm tra ở MỌI request mà không cần query
 * DB mỗi lần — chỉ đọc/ghi DB khi Admin thực sự thay đổi cấu hình.
 */
@Service
@RequiredArgsConstructor
public class SystemSettingsService {

    /** Thời gian dự kiến bảo trì kể từ lúc Admin bật - cố định, không phụ thuộc client. */
    private static final long MAINTENANCE_DURATION_HOURS = 7;

    private final SystemSettingsRepository settingsRepository;

    private final AtomicBoolean maintenanceModeCache = new AtomicBoolean(false);
    private final AtomicReference<Instant> maintenanceUntilCache = new AtomicReference<>();

    @PostConstruct
    void init() {
        SystemSettings settings = getOrCreate();
        maintenanceModeCache.set(settings.isMaintenanceMode());
        maintenanceUntilCache.set(computeUntil(settings));
    }

    public boolean isMaintenanceModeOn() {
        return maintenanceModeCache.get();
    }

    public Instant getMaintenanceUntil() {
        return maintenanceUntilCache.get();
    }

    @Transactional(readOnly = true)
    public SystemSettingsResponse getSettings() {
        return toResponse(getOrCreate());
    }

    @Transactional
    public SystemSettingsResponse updateSettings(UpdateSystemSettingsRequest request) {
        SystemSettings settings = getOrCreate();
        // Cũng coi là "vừa bật" nếu bảo trì đã bật sẵn nhưng chưa từng có mốc
        // giờ (dữ liệu cũ từ trước khi có tính năng đếm ngược) - tự phục hồi
        // thay vì kẹt ở null mãi mãi cho tới khi Admin tắt rồi bật lại.
        boolean turningOn = request.maintenanceMode()
                && (!settings.isMaintenanceMode() || settings.getMaintenanceStartedAt() == null);

        settings.setMaintenanceMode(request.maintenanceMode());
        settings.setPlatformFeePercent(request.platformFeePercent());

        // Mốc đếm ngược chỉ đổi khi Admin thực sự BẬT bảo trì (off -> on).
        // Lưu ở đây (không phải trên client) để mọi role đều thấy cùng một
        // deadline, không bị reset lại mỗi lần load trang.
        if (turningOn) {
            settings.setMaintenanceStartedAt(Instant.now());
        } else if (!request.maintenanceMode()) {
            settings.setMaintenanceStartedAt(null);
        }

        settings = settingsRepository.save(settings);
        maintenanceModeCache.set(settings.isMaintenanceMode());
        maintenanceUntilCache.set(computeUntil(settings));
        return toResponse(settings);
    }

    private SystemSettings getOrCreate() {
        return settingsRepository.findById(SystemSettings.SINGLETON_ID)
                .orElseGet(() -> settingsRepository.save(new SystemSettings()));
    }

    private Instant computeUntil(SystemSettings settings) {
        if (!settings.isMaintenanceMode() || settings.getMaintenanceStartedAt() == null) {
            return null;
        }
        return settings.getMaintenanceStartedAt().plus(MAINTENANCE_DURATION_HOURS, ChronoUnit.HOURS);
    }

    private SystemSettingsResponse toResponse(SystemSettings settings) {
        return new SystemSettingsResponse(
                settings.isMaintenanceMode(),
                settings.getPlatformFeePercent(),
                settings.getUpdatedAt(),
                computeUntil(settings)
        );
    }
}
