package com.beeacademy.backend.security;

import com.beeacademy.backend.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {}

    public static AuthenticatedUser required() {
        AuthenticatedUser user = optional();
        if (user == null) {
            throw new UnauthorizedException("UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này");
        }
        return user;
    }

    public static AuthenticatedUser optional() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        return principal instanceof AuthenticatedUser au ? au : null;
    }
}
