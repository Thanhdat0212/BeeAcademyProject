package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Profile;

import java.time.Instant;
import java.util.UUID;

/**
 * Shape đầy đủ của Profile trả về frontend cho endpoint {@code GET /api/me}
 * và sau khi {@code PUT /api/me} cập nhật.
 *
 * <p>Khác {@link UserSummaryResponse} (chỉ id/email/role/fullName/avatar):
 * {@code ProfileResponse} có thêm phone, bio, social links và timestamps.
 * Tách 2 DTO để các endpoint khác (login, register) trả response gọn,
 * không kèm bio dài dòng.
 *
 * <p>QUAN TRỌNG - field KHÔNG đưa vào response:
 * <ul>
 *   <li>Không có password / password_hash (Supabase giữ riêng).</li>
 *   <li>Không có raw {@code user_metadata} (có thể chứa key nội bộ).</li>
 * </ul>
 *
 * <p>Email lấy từ JWT context (không có trong entity Profile vì
 * {@code auth.users} là chỗ duy nhất quản lý email).
 *
 * @param id          UUID profile (= auth.users.id)
 * @param email       email người dùng
 * @param role        student/parent/teacher/admin
 * @param fullName    họ tên
 * @param phone       SĐT (có thể null)
 * @param bio         tiểu sử (có thể null)
 * @param avatarUrl   URL ảnh đại diện (public URL trên Supabase Storage)
 * @param twitterUrl  link Twitter
 * @param facebookUrl link Facebook
 * @param linkedinUrl link LinkedIn
 * @param createdAt   thời điểm tạo tài khoản
 * @param updatedAt   lần cuối cập nhật profile
 */
public record ProfileResponse(
        UUID id,
        String email,
        String role,
        String fullName,
        String phone,
        String bio,
        String avatarUrl,
        String twitterUrl,
        String facebookUrl,
        String linkedinUrl,
        Instant createdAt,
        Instant updatedAt
) {

    /**
     * Mapping factory từ entity {@link Profile} + email (lấy từ JWT).
     *
     * <p>Tách hàm map vào DTO (thay vì service) giúp service mỏng và mọi
     * thay đổi shape chỉ phải sửa 1 chỗ.
     *
     * @param profile entity từ DB
     * @param email   email lấy từ AuthenticatedUser
     */
    public static ProfileResponse fromEntity(Profile profile, String email) {
        return new ProfileResponse(
                profile.getId(),
                email,
                profile.getRole() != null ? profile.getRole().toDbValue() : null,
                profile.getFullName(),
                profile.getPhone(),
                profile.getBio(),
                profile.getAvatarUrl(),
                profile.getTwitterUrl(),
                profile.getFacebookUrl(),
                profile.getLinkedinUrl(),
                profile.getCreatedAt(),
                profile.getUpdatedAt()
        );
    }
}
