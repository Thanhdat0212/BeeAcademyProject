package com.beeacademy.backend.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;
import java.util.UUID;

/**
 * Đại diện cho object {@code user} mà Supabase GoTrue trả về (signup,
 * login, refresh, update đều có).
 *
 * <p>Đây là DTO nội bộ giữa {@code SupabaseAuthClient} và {@code AuthService}
 * - KHÔNG expose trực tiếp ra REST API. Controller sẽ map sang
 * {@code UserSummaryResponse} (snake_case → camelCase, lọc bớt field) trước
 * khi trả về frontend.
 *
 * <p>{@code @JsonIgnoreProperties(ignoreUnknown=true)} - bảo vệ trước
 * trường hợp Supabase thêm field mới, ta không phải sửa code này.
 *
 * @param id           UUID user (Supabase tự sinh)
 * @param email        email đã đăng ký
 * @param emailConfirmedAt  ISO timestamp khi user xác nhận email (null = chưa xác nhận)
 * @param userMetadata object chứa role + fullName ta gửi lên khi signup
 * @param appMetadata  object server-side - chứa {@code provider}, có thể có {@code role}
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProviderUser(
        UUID id,
        String email,

        @JsonProperty("email_confirmed_at")
        String emailConfirmedAt,

        @JsonProperty("user_metadata")
        Map<String, Object> userMetadata,

        @JsonProperty("app_metadata")
        Map<String, Object> appMetadata
) {

    /**
     * Helper lấy role từ metadata. Ưu tiên {@code app_metadata.role}
     * (server set, không bị client sửa được) > {@code user_metadata.role}.
     *
     * @return role dạng string viết thường, hoặc null nếu không có
     */
    public String extractRole() {
        if (appMetadata != null && appMetadata.get("role") instanceof String r) return r;
        if (userMetadata != null && userMetadata.get("role") instanceof String r) return r;
        return null;
    }

    /** Helper lấy full_name từ user_metadata. */
    public String extractFullName() {
        if (userMetadata != null && userMetadata.get("full_name") instanceof String n) return n;
        return null;
    }
}
