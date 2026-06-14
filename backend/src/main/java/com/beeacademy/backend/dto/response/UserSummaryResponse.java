package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.client.dto.ProviderUser;
import com.beeacademy.backend.model.Profile;

import java.util.UUID;

/**
 * Thông tin user gọn được trả về frontend - dùng trong các response
 * auth (register, login, refresh) và profile.
 *
 * <p>Tách khỏi {@link ProviderUser} (DTO nội bộ với Supabase) để:
 * <ul>
 *   <li>Không expose snake_case ra ngoài (frontend nhận camelCase).</li>
 *   <li>Lọc bớt field nhạy cảm (app_metadata, raw timestamps).</li>
 *   <li>Tự do thay đổi shape mà không phá interface client với Supabase.</li>
 * </ul>
 *
 * @param id        UUID user (= profiles.id)
 * @param email     email từ {@code auth.users}
 * @param role      vai trò (student/parent/teacher/admin)
 * @param fullName  họ tên hiển thị
 * @param avatarUrl URL ảnh đại diện (null nếu chưa upload)
 */
public record UserSummaryResponse(
        UUID id,
        String email,
        String role,
        String fullName,
        String avatarUrl
) {

    /**
     * Map từ ProviderUser (response GoTrue) - dùng khi vừa register/login,
     * Profile có thể chưa được fetch.
     */
    public static UserSummaryResponse fromProvider(ProviderUser user) {
        return new UserSummaryResponse(
                user.id(),
                user.email(),
                user.extractRole(),
                user.extractFullName(),
                null
        );
    }

    /**
     * Map từ Profile + email lấy riêng (vì entity Profile không lưu email -
     * email do auth.users giữ).
     */
    public static UserSummaryResponse fromProfile(Profile profile, String email) {
        return new UserSummaryResponse(
                profile.getId(),
                email,
                profile.getRole() != null ? profile.getRole().toDbValue() : null,
                profile.getFullName(),
                profile.getAvatarUrl()
        );
    }
}
