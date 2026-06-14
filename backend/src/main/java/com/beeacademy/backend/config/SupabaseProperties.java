package com.beeacademy.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Type-safe configuration cho các giá trị Supabase đọc từ application.yml.
 *
 * <p>Tương ứng với block:
 * <pre>
 * supabase:
 *   url: ...
 *   anon-key: ...
 *   service-role-key: ...
 *   jwt-secret: ...
 * </pre>
 *
 * <p>Dùng {@code record} (Java 17+) để immutable và gọn. Spring Boot tự bind
 * constructor params với prefix {@code supabase.*}.
 *
 * <p>Vai trò từng trường:
 * <ul>
 *   <li>{@code url}: base URL của Supabase project (vd:
 *       https://xxx.supabase.co). Dùng để compose endpoint GoTrue
 *       ({@code /auth/v1/...}) và Storage ({@code /storage/v1/...}).</li>
 *   <li>{@code anonKey}: API key public, gắn vào header {@code apikey} cho
 *       các call PUBLIC (vd: signup, login). KHÔNG bí mật.</li>
 *   <li>{@code serviceRoleKey}: API key có quyền admin. Gắn cho các call
 *       cần bypass RLS hoặc thao tác admin (vd: tạo user thủ công, list
 *       user). BÍ MẬT - chỉ để trong .env, không lộ ra client.</li>
 *   <li>{@code jwtSecret}: secret HS256 dùng để verify chữ ký JWT do Supabase
 *       phát hành. Lấy từ Project Settings → API → JWT Secret. BÍ MẬT.</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "supabase")
public record SupabaseProperties(
        String url,
        String anonKey,
        String serviceRoleKey,
        String jwtSecret
) {
}
