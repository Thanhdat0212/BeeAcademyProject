package com.beeacademy.backend.security;

import java.util.UUID;

/**
 * Nguoi dung da xac thuc - dat vao SecurityContext sau khi verify JWT.
 * Dung record cho immutability.
 */
public record AuthenticatedUser(
        UUID userId,
        String email,
        String role
) {}
