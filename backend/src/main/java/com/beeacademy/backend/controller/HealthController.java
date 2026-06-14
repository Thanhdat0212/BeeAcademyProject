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

/**
 * Health check endpoint - dùng để verify Giai đoạn 0 đã setup xong.
 *
 * <p>Cung cấp {@code GET /api/health} (public, không cần JWT) trả về:
 * <ul>
 *   <li>{@code status}: trạng thái tổng thể ({@code ok} / {@code degraded})</li>
 *   <li>{@code db}: trạng thái kết nối Supabase Postgres ({@code up} / {@code down})</li>
 *   <li>{@code app}: tên ứng dụng (để verify đúng service đang chạy)</li>
 * </ul>
 *
 * <p>Dùng cho:
 * <ul>
 *   <li>Smoke test sau khi {@code mvn spring-boot:run}.</li>
 *   <li>Liveness/readiness probe khi deploy (Railway, Render).</li>
 *   <li>Monitor uptime từ frontend hoặc UptimeRobot.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor   // Lombok: tự sinh constructor cho field final → DI sạch
public class HealthController {

    /**
     * JdbcTemplate được Spring Boot auto-cấu hình dựa trên DataSource đã
     * khai báo trong application.yml. Dùng để chạy câu lệnh đơn giản
     * {@code SELECT 1} kiểm tra connection còn sống không.
     *
     * <p>KHÔNG dùng EntityManager hay Repository ở đây - chỉ cần raw JDBC.
     */
    private final JdbcTemplate jdbcTemplate;

    /**
     * Endpoint health check.
     *
     * <p>Logic:
     * <ol>
     *   <li>Thử query {@code SELECT 1} - nếu trả 1 → DB up.</li>
     *   <li>Bắt mọi exception → đánh dấu DB down nhưng vẫn trả 200 với
     *       trường {@code db: "down"} (không ném 500). Cho phép client
     *       phân biệt "service đang chạy nhưng DB lỗi".</li>
     * </ol>
     *
     * @return ApiResponse bọc Map trạng thái
     */
    @GetMapping("/health")
    public ApiResponse<Map<String, String>> health() {
        // LinkedHashMap để giữ thứ tự field khi serialize JSON (status → db → app)
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("app", "bee-academy-backend");
        payload.put("db", checkDatabase());
        payload.put("status", "up".equals(payload.get("db")) ? "ok" : "degraded");
        return ApiResponse.ok(payload);
    }

    /**
     * Kiểm tra connection Postgres bằng cách chạy {@code SELECT 1}.
     *
     * @return {@code "up"} nếu kết nối OK, {@code "down"} nếu lỗi
     */
    private String checkDatabase() {
        try {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return (result != null && result == 1) ? "up" : "down";
        } catch (Exception ex) {
            // Log warning - đừng để health check vỡ chuỗi vì lỗi DB
            log.warn("Health check DB query failed: {}", ex.getMessage());
            return "down";
        }
    }
}
