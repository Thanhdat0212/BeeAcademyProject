package com.beeacademy.backend.model;

import java.util.Arrays;

/**
 * Vai trò người dùng trong hệ thống.
 *
 * <p>Ánh xạ 1-1 với enum Postgres {@code user_role} trên Supabase
 * (đã verify: {@code {student, parent, teacher, admin}}).
 *
 * <p>Lưu ý cú pháp:
 * <ul>
 *   <li>Java convention: tên enum viết HOA ({@code STUDENT}).</li>
 *   <li>Postgres enum: viết thường ({@code student}). JPA mặc định
 *       so sánh chuỗi → ta map qua {@link #toDbValue()} và
 *       {@link #fromDbValue(String)}.</li>
 * </ul>
 */
public enum UserRole {

    STUDENT,
    PARENT,
    TEACHER,
    ADMIN;

    /**
     * Giá trị chuỗi viết thường đúng như Postgres enum.
     * Dùng khi cần gửi role qua HTTP (vd: lưu vào JWT metadata Supabase).
     */
    public String toDbValue() {
        return name().toLowerCase();
    }

    /**
     * Parse từ chuỗi (thường là input của user hoặc value Postgres trả về).
     * Case-insensitive để chấp nhận "student", "Student", "STUDENT".
     *
     * @param value chuỗi cần parse
     * @return enum tương ứng, hoặc null nếu không khớp
     */
    public static UserRole fromDbValue(String value) {
        if (value == null) return null;
        return Arrays.stream(values())
                .filter(r -> r.name().equalsIgnoreCase(value))
                .findFirst()
                .orElse(null);
    }

    /**
     * Kiểm tra role có hợp lệ cho đăng ký công khai không.
     * KHÔNG cho phép {@link #ADMIN} - admin phải được tạo qua đường nội bộ.
     */
    public boolean isAllowedForPublicSignup() {
        return this == STUDENT || this == PARENT || this == TEACHER;
    }
}
