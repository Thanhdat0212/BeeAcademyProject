package com.beeacademy.backend.security;

import java.util.UUID;

/**
 * Đại diện cho người dùng đã xác thực thành công qua JWT của Supabase.
 *
 * <p>Đây là object được đặt vào {@code SecurityContext} sau khi
 * {@code JwtAuthenticationFilter} verify token thành công, để các tầng phía
 * sau (controller, service) đọc ra mà không cần parse JWT lại.
 *
 * <p>Record (Java 17+) → immutable, value object đúng chuẩn.
 *
 * <p>Vì sao dùng UUID cho {@code userId}: Supabase Auth phát hành user id
 * theo định dạng UUID v4 (vd: {@code 550e8400-e29b-41d4-a716-446655440000}),
 * lưu vào cột {@code public.profiles.id} kiểu {@code uuid}. Dùng UUID giúp
 * type-safe và tránh nhầm với String khác.
 *
 * @param userId id của user (claim {@code sub} trong JWT)
 * @param email  email của user (claim {@code email} trong JWT) - tiện log/audit
 * @param role   vai trò trong hệ thống: student / parent / teacher / admin.
 *               Lấy từ claim {@code user_metadata.role} hoặc {@code app_metadata.role}
 *               của Supabase. Dùng cho phân quyền {@code @PreAuthorize}.
 */
public record AuthenticatedUser(
        UUID userId,
        String email,
        String role
) {
}
