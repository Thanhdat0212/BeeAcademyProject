package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity ánh xạ bảng {@code public.profiles} trên Supabase.
 *
 * <p>Mỗi profile liên kết 1-1 với row trong {@code auth.users} (Supabase
 * quản lý). Khoá chung là {@code id UUID}.
 *
 * <p>Triết lý Rich Domain Model:
 * <ul>
 *   <li>Setter của field nhạy cảm ({@code id}, {@code role}) bị giới hạn
 *       {@code PRIVATE} → ngoài entity chỉ đổi qua method nghiệp vụ.</li>
 *   <li>Phương thức {@link #updatePersonalInfo} đảm bảo invariant - vd
 *       không ai set {@code fullName} thành chuỗi rỗng được.</li>
 *   <li>JPA cần constructor không tham số → dùng
 *       {@code @NoArgsConstructor(access = PROTECTED)} để hạn chế gọi
 *       trực tiếp; tạo profile mới qua factory {@link #createNew}.</li>
 * </ul>
 *
 * <p>Vì cột {@code role} ở Postgres là enum {@code user_role} (custom type),
 * Hibernate cần biết đây là {@code SqlTypes.NAMED_ENUM} để bind đúng.
 * Annotation {@code @JdbcTypeCode(SqlTypes.NAMED_ENUM)} + tên enum trùng
 * với tên Postgres enum giải quyết việc này.
 */
@Entity
@Table(name = "profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)   // JPA cần - không cho new bừa
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder(access = AccessLevel.PRIVATE)
public class Profile {

    /**
     * UUID trùng với {@code auth.users.id}. KHÔNG generate ở Java - ID đã
     * được Supabase Auth tạo khi signup, ta chỉ copy về.
     */
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /**
     * Vai trò - map với Postgres native enum {@code user_role}.
     * Converter xử lý STUDENT↔student; ColumnTransformer cast sang
     * user_role khi INSERT/UPDATE để Postgres chấp nhận đúng type.
     */
    @Convert(converter = UserRoleConverter.class)
    @ColumnTransformer(read = "role::text", write = "?::user_role")
    @Column(name = "role", nullable = false)
    private UserRole role;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "phone")
    private String phone;

    @Column(name = "bio")
    private String bio;

    @Column(name = "twitter_url")
    private String twitterUrl;

    @Column(name = "facebook_url")
    private String facebookUrl;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(name = "is_blocked", nullable = false)
    private boolean isBlocked = false;

    /** Hibernate tự set khi INSERT - KHÔNG override. */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Hibernate tự update mỗi khi UPDATE. */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ========================================================================
    // Factory + Business methods (Rich Domain Model)
    // ========================================================================

    /**
     * Factory chuẩn để tạo profile mới sau khi user đã được Supabase Auth tạo.
     *
     * <p>Bắt buộc truyền {@code authUserId} (lấy từ response GoTrue) và
     * {@code role}. {@code fullName} có thể null - user cập nhật sau ở UC05.
     *
     * @param authUserId UUID từ {@code auth.users.id}
     * @param role       vai trò khi đăng ký
     * @param fullName   họ tên (có thể null)
     * @return Profile mới, chưa được save
     */
    public static Profile createNew(UUID authUserId, UserRole role, String fullName) {
        if (authUserId == null) throw new IllegalArgumentException("authUserId không được null");
        if (role == null) throw new IllegalArgumentException("role không được null");
        return Profile.builder()
                .id(authUserId)
                .role(role)
                .fullName(fullName)
                .build();
    }

    /**
     * Cập nhật thông tin cá nhân (UC05).
     *
     * <p>Đảm bảo invariant: chỉ cập nhật field nào client gửi (null = giữ
     * nguyên), {@code fullName} nếu cung cấp phải có ít nhất 1 ký tự sau
     * khi trim - nếu không sẽ ném IllegalArgumentException (sẽ được
     * {@code GlobalExceptionHandler} chuyển thành lỗi 400 thông qua
     * tầng validation, không bao giờ rò ra DB).
     */
    public void updatePersonalInfo(String fullName,
                                   String phone,
                                   String bio,
                                   String twitterUrl,
                                   String facebookUrl,
                                   String linkedinUrl) {
        if (fullName != null) {
            String trimmed = fullName.trim();
            if (trimmed.isEmpty()) {
                throw new IllegalArgumentException("fullName không được trống");
            }
            this.fullName = trimmed;
        }
        if (phone != null) this.phone = phone.trim();
        if (bio != null) this.bio = bio;
        if (twitterUrl != null) this.twitterUrl = twitterUrl;
        if (facebookUrl != null) this.facebookUrl = facebookUrl;
        if (linkedinUrl != null) this.linkedinUrl = linkedinUrl;
    }

    /** Cập nhật URL avatar sau khi upload thành công lên Supabase Storage. */
    public void changeAvatar(String newAvatarUrl) {
        this.avatarUrl = newAvatarUrl;
    }

    public void block()   { this.isBlocked = true; }
    public void unblock() { this.isBlocked = false; }
    public void changeRole(UserRole newRole) { this.role = newRole; }
}

