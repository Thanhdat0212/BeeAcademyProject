package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/health")
    public ApiResponse<Map<String, String>> health() {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("app", "bee-academy-backend");
        payload.put("db", checkDatabase());
        payload.put("status", "up".equals(payload.get("db")) ? "ok" : "degraded");
        return ApiResponse.ok(payload);
    }

    private String checkDatabase() {
        try {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return (result != null && result == 1) ? "up" : "down";
        } catch (Exception ex) {
            log.warn("Health check DB query failed: {}", ex.getMessage());
            return "down";
        }
    }
}
