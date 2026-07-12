package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "system_settings")
@Getter
@Setter
@NoArgsConstructor
public class SystemSettings {

    /** Bảng single-row - luôn có duy nhất 1 dòng với id = 1. */
    public static final int SINGLETON_ID = 1;

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id = SINGLETON_ID;

    @Column(name = "maintenance_mode", nullable = false)
    private boolean maintenanceMode = false;

    @Column(name = "platform_fee_percent", nullable = false)
    private int platformFeePercent = 20;

    /** Thời điểm Admin bật bảo trì lần gần nhất - null khi đang tắt. */
    @Column(name = "maintenance_started_at")
    private Instant maintenanceStartedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
