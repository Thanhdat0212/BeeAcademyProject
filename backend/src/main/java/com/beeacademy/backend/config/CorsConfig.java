package com.beeacademy.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Cấu hình CORS (Cross-Origin Resource Sharing).
 *
 * <p>Frontend chạy ở {@code http://localhost:3000} (Vite, theo
 * vite.config.ts đã cố định port). Backend chạy ở
 * {@code http://localhost:8080}. Trình duyệt sẽ chặn request cross-origin
 * trừ khi backend trả header {@code Access-Control-Allow-Origin} hợp lệ →
 * đây là chỗ ta khai báo origin nào được phép.
 *
 * <p>Cấu hình này được đăng ký vào {@link SecurityConfig#securityFilterChain}
 * qua {@code .cors(...)} → Spring Security đảm bảo preflight {@code OPTIONS}
 * đi qua trước bất kỳ filter auth nào.
 */
@Configuration
public class CorsConfig {

    /** Danh sách origin được phép, cấu hình qua biến CORS_ALLOWED_ORIGINS. */
    @Value("${app.cors.allowed-origins}")
    private String allowedOriginsCsv;

    /**
     * Bean {@code corsConfigurationSource} được {@link SecurityConfig} sử dụng.
     *
     * @return source cấu hình CORS cho tất cả URL {@code /**}
     */
    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Tách CSV "http://a, http://b" → list. Trim để chấp nhận khoảng trắng.
        List<String> origins = Arrays.stream(allowedOriginsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        config.setAllowedOrigins(origins);

        // Cho phép tất cả method REST chuẩn (GET, POST, PUT, DELETE, PATCH, OPTIONS).
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // Cho phép mọi header → tránh tự bảo trì danh sách Authorization, Content-Type,...
        config.setAllowedHeaders(List.of("*"));

        // Cho phép gửi cookie/Authorization header (cần thiết khi frontend gửi JWT).
        config.setAllowCredentials(true);

        // Cache preflight 1 giờ → giảm số request OPTIONS thừa lên backend.
        config.setMaxAge(3600L);

        // Áp dụng config trên cho mọi URL
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
