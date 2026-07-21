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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Builder.Default
    @Column(name = "parent_privacy_enabled", nullable = false)
    private boolean parentPrivacyEnabled = true;

    @Column(name = "twitter_url")
    private String twitterUrl;

    @Column(name = "facebook_url")
    private String facebookUrl;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Builder.Default
    @Column(name = "is_blocked", nullable = false)
    private boolean isBlocked = false;

    @Builder.Default
    @Column(name = "teacher_approval_status", nullable = false, length = 24)
    private String teacherApprovalStatus = TeacherApprovalStatus.APPROVED.toDbValue();

    /**
     * Bật khi Admin cấp mật khẩu tạm cho tài khoản (tạo mới hoặc cấp lại).
     * Mật khẩu tạm đã đi qua kênh ngoài hệ thống (Zalo/Facebook/email) nên
     * user phải đổi trước khi dùng bất kỳ chức năng nào.
     */
    @Builder.Default
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    /** Admin đã tạo tài khoản này - null nếu user tự đăng ký. */
    @Column(name = "created_by_admin_id")
    private UUID createdByAdminId;

    /** Kênh liên hệ Admin dùng để trao tài khoản cho GV (link Facebook/Zalo/SĐT). */
    @Column(name = "teacher_contact_note")
    private String teacherContactNote;

    /**
     * Khóa tạm do đăng nhập sai liên tiếp (REQ-AUTH-002) — tách biệt hoàn toàn
     * với {@link #isBlocked} (khóa vĩnh viễn do Admin thao tác).
     */
    @Builder.Default
    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts = 0;

    @Column(name = "last_failed_login_at")
    private Instant lastFailedLoginAt;

    @Column(name = "failed_login_lock_until")
    private Instant failedLoginLockUntil;

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
     * Factory cho tài khoản giáo viên do Admin cấp.
     *
     * <p>Khác {@link #createNew}: role cố định TEACHER, trạng thái duyệt là
     * APPROVED ngay (Admin cấp = đã thẩm định ngoài hệ thống, không bắt duyệt
     * lại), và bật {@code mustChangePassword} vì mật khẩu tạm đã đi qua kênh
     * ngoài hệ thống.
     *
     * @param authUserId  UUID từ {@code auth.users.id}
     * @param fullName    họ tên GV
     * @param adminId     Admin thực hiện thao tác - lưu để audit
     * @param contactNote kênh liên hệ đã dùng để trao tài khoản (có thể null)
     */
    public static Profile createTeacherByAdmin(UUID authUserId,
                                               String fullName,
                                               UUID adminId,
                                               String contactNote) {
        Profile profile = createNew(authUserId, UserRole.TEACHER, fullName);
        profile.approveTeacher();
        profile.markMustChangePassword();
        profile.createdByAdminId = adminId;
        profile.teacherContactNote = contactNote;
        return profile;
    }

    /** Admin vừa cấp mật khẩu tạm - buộc user đổi ở lần đăng nhập kế tiếp. */
    public void markMustChangePassword() {
        this.mustChangePassword = true;
    }

    /** User đã tự đặt mật khẩu mới - gỡ ràng buộc. */
    public void clearMustChangePassword() {
        this.mustChangePassword = false;
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

    private static final int MAX_FAILED_LOGIN_ATTEMPTS = 5;
    private static final long FAILED_LOGIN_WINDOW_MINUTES = 15L;
    private static final long FAILED_LOGIN_LOCK_MINUTES = 15L;

    public boolean isTemporarilyLocked() {
        return failedLoginLockUntil != null && Instant.now().isBefore(failedLoginLockUntil);
    }

    /**
     * Ghi nhận 1 lần đăng nhập sai. Nếu lần sai gần nhất đã quá
     * {@link #FAILED_LOGIN_WINDOW_MINUTES} phút thì không còn tính là
     * "liên tiếp" — đếm lại từ 1. Đạt {@link #MAX_FAILED_LOGIN_ATTEMPTS}
     * lần trong cửa sổ đó thì khóa tạm {@link #FAILED_LOGIN_LOCK_MINUTES} phút.
     */
    public void registerFailedLogin() {
        Instant now = Instant.now();
        if (lastFailedLoginAt == null
                || lastFailedLoginAt.isBefore(now.minus(FAILED_LOGIN_WINDOW_MINUTES, ChronoUnit.MINUTES))) {
            this.failedLoginAttempts = 1;
        } else {
            this.failedLoginAttempts++;
        }
        this.lastFailedLoginAt = now;
        if (this.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            this.failedLoginLockUntil = now.plus(FAILED_LOGIN_LOCK_MINUTES, ChronoUnit.MINUTES);
        }
    }

    public void resetFailedLogin() {
        this.failedLoginAttempts = 0;
        this.failedLoginLockUntil = null;
    }

    public boolean isApprovedTeacher() {
        return role == UserRole.TEACHER
                && !isBlocked
                && TeacherApprovalStatus.APPROVED.toDbValue().equalsIgnoreCase(teacherApprovalStatus);
    }

    public void markTeacherPendingApproval() {
        if (role != UserRole.TEACHER) {
            throw new IllegalStateException("Chỉ tài khoản giáo viên mới có trạng thái duyệt.");
        }
        this.teacherApprovalStatus = TeacherApprovalStatus.PENDING.toDbValue();
    }

    public void approveTeacher() {
        this.teacherApprovalStatus = TeacherApprovalStatus.APPROVED.toDbValue();
    }

    public void rejectTeacher() {
        if (role != UserRole.TEACHER) {
            throw new IllegalStateException("Chỉ tài khoản giáo viên mới có trạng thái duyệt.");
        }
        this.teacherApprovalStatus = TeacherApprovalStatus.REJECTED.toDbValue();
    }
}

