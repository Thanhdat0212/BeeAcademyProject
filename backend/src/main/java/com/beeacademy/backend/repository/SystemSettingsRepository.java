package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.SystemSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemSettingsRepository extends JpaRepository<SystemSettings, Integer> {
}
