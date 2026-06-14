package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

/** Thông tin user cho trang Admin Quản lý tài khoản. */
public record AdminUserResponse(
        UUID    id,
        String  fullName,
        String  email,
        String  role,        // student | teacher | parent | admin
        String  avatarUrl,
        boolean isBlocked,
        Instant createdAt
) {
    /** Map từ native query Object[] row. */
    public static AdminUserResponse fromRow(Object[] row) {
        return new AdminUserResponse(
                row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString()),
                row[1] != null ? row[1].toString() : null,
                row[6] != null ? row[6].toString() : null,
                row[3] != null ? row[3].toString() : null,
                row[2] != null ? row[2].toString() : null,
                row[4] != null && Boolean.parseBoolean(row[4].toString()),
                row[5] instanceof Instant i ? i : Instant.parse(row[5].toString())
        );
    }
}
