package com.beeacademy.backend.client.dto;

import java.util.Map;

/**
 * Body request gửi sang {@code PUT /auth/v1/user} của Supabase GoTrue.
 *
 * <p>Dùng để đổi mật khẩu hoặc cập nhật email/metadata. Yêu cầu header
 * {@code Authorization: Bearer <access_token>} - Supabase tự biết update
 * cho user nào dựa vào JWT.
 *
 * <p>Tất cả field nullable - chỉ gửi field nào muốn đổi.
 *
 * @param password mật khẩu mới (raw, Supabase tự hash)
 * @param email    email mới (Supabase sẽ gửi confirm link)
 * @param data     metadata mới ghi đè user_metadata
 */
public record ProviderUpdateUserRequest(
        String password,
        String email,
        Map<String, Object> data
) {

    /** Factory chỉ đổi password - dùng cho change-password use case. */
    public static ProviderUpdateUserRequest changePassword(String newPassword) {
        return new ProviderUpdateUserRequest(newPassword, null, null);
    }
}
