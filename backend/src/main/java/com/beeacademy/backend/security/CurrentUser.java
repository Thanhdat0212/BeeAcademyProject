package com.beeacademy.backend.security;

import com.beeacademy.backend.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Utility lấy {@link AuthenticatedUser} đang đăng nhập từ
 * {@code SecurityContext}.
 *
 * <p>Sau khi {@code JwtAuthenticationFilter} verify JWT thành công, nó đã
 * đặt {@code AuthenticatedUser} vào principal của
 * {@code UsernamePasswordAuthenticationToken}. Class này wrap việc đọc
 * lại cho controller dùng gọn 1 dòng:
 * <pre>
 *   AuthenticatedUser me = CurrentUser.required();
 * </pre>
 *
 * <p>Vì sao không dùng {@code @AuthenticationPrincipal}: cách đó cần khai
 * báo ở từng method param, dài hơn. Helper static gọn hơn cho controller mỏng.
 */
public final class CurrentUser {

    /** Class utility - không cho new instance. */
    private CurrentUser() {
    }

    /**
     * Lấy user hiện tại, ném {@link UnauthorizedException} nếu chưa
     * authenticate (gọi từ endpoint protected mà context rỗng).
     */
    public static AuthenticatedUser required() {
        AuthenticatedUser user = optional();
        if (user == null) {
            throw new UnauthorizedException("UNAUTHORIZED",
                    "Bạn cần đăng nhập để thực hiện thao tác này");
        }
        return user;
    }

    /**
     * Lấy user hiện tại, trả null nếu chưa authenticate (cho endpoint
     * tuỳ chọn auth, vd: courses list có thể hiển thị khác cho guest).
     */
    public static AuthenticatedUser optional() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        return principal instanceof AuthenticatedUser au ? au : null;
    }
}
