package com.beeacademy.backend.client.dto;

import java.util.Map;

/**
 * Body request gửi sang {@code POST /auth/v1/signup} của Supabase.
 *
 * <p>Format đúng với Supabase GoTrue spec:
 * <pre>
 * {
 *   "email":    "user@example.com",
 *   "password": "...",
 *   "data": {                  // → user_metadata trong JWT
 *     "role":      "student",
 *     "full_name": "Nguyễn Văn A"
 *   }
 * }
 * </pre>
 *
 * <p>Field {@code data} là free-form map → để Supabase nhét vào
 * {@code user_metadata} của user. Backend dùng cả `role` để biết user
 * thuộc nhóm nào ngay từ JWT (khỏi join DB).
 *
 * @param email    email đăng ký (đã validate ở service)
 * @param password mật khẩu raw - Supabase tự hash bcrypt phía họ
 * @param data     metadata gửi kèm (role, full_name, ...)
 */
public record ProviderSignUpRequest(
        String email,
        String password,
        Map<String, Object> data
) {
}
