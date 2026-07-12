package com.beeacademy.backend.config;

import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.service.SystemSettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;

/**
 * Chặn toàn bộ request không phải admin khi hệ thống đang ở chế độ bảo trì.
 *
 * <p>Chạy SAU {@link JwtAuthenticationFilter} nên role (nếu có JWT hợp lệ)
 * đã được resolve vào {@link SecurityContextHolder}. Cho qua một allowlist
 * nhỏ (auth endpoints, health check, chính status endpoint, webhook thanh
 * toán) vì trước khi xác thực thì chưa biết role — nếu chặn luôn cả
 * {@code /api/auth/login} thì Admin cũng không đăng nhập lại được để tắt
 * bảo trì.
 */
@Component
@RequiredArgsConstructor
public class MaintenanceModeFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWLIST = Set.of(
            "/api/system/status",
            "/api/health",
            "/api/auth/**",
            "/api/webhooks/payos"
    );

    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private final SystemSettingsService settingsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        if (!settingsService.isMaintenanceModeOn()
                || HttpMethod.OPTIONS.matches(request.getMethod())
                || isAllowlisted(request.getServletPath())) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user)
                ? user.role()
                : null;

        if ("admin".equals(role)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json;charset=UTF-8");
        Instant until = settingsService.getMaintenanceUntil();
        response.getWriter().write(
                "{\"success\":false,\"code\":\"MAINTENANCE_MODE\"," +
                "\"message\":\"Hệ thống đang bảo trì, vui lòng quay lại sau.\"," +
                "\"maintenanceUntil\":" + (until != null ? "\"" + until + "\"" : "null") + "}");
    }

    private boolean isAllowlisted(String servletPath) {
        return ALLOWLIST.stream().anyMatch(pattern -> pathMatcher.match(pattern, servletPath));
    }
}
