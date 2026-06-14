package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.request.UpdateProfileRequest;
import com.beeacademy.backend.dto.response.ProfileResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Tầng nghiệp vụ cho phân hệ Profile (UC05 - quản lý hồ sơ cá nhân).
 *
 * <p>Quy tắc bất di bất dịch:
 * <ul>
 *   <li>Mọi thao tác đều dựa trên {@code userId} từ {@link AuthenticatedUser}
 *       (controller lấy từ {@code SecurityContext}). KHÔNG nhận userId từ
 *       parameter của HTTP request - chống IDOR (Insecure Direct Object
 *       Reference).</li>
 *   <li>Service không trực tiếp dùng {@code SecurityContextHolder} - tuân
 *       thủ DIP, dễ unit test. Controller truyền {@link AuthenticatedUser}
 *       xuống.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    /** Bucket Supabase Storage dành cho avatar. Phải được tạo PUBLIC trên Dashboard. */
    private static final String AVATAR_BUCKET = "avatars";

    /** MIME types được chấp nhận cho avatar. */
    private static final Set<String> ALLOWED_AVATAR_MIME = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    /** Kích thước tối đa file avatar = 2MB. */
    private static final long MAX_AVATAR_SIZE_BYTES = 2L * 1024 * 1024;

    private final ProfileRepository profileRepository;
    private final SupabaseStorageClient storageClient;

    // ========================================================================
    // GET /api/me - lấy hồ sơ
    // ========================================================================

    /**
     * Trả về profile của user đang đăng nhập.
     *
     * <p>Đọc-only, không cần transaction.
     *
     * @param me user từ JWT context
     * @return ProfileResponse đầy đủ thông tin
     * @throws ResourceNotFoundException nếu profile chưa tồn tại (lỗi sync
     *         hiếm gặp - auth user có nhưng profile chưa được tạo)
     */
    /**
     * Trả về profile của user đang đăng nhập.
     *
     * <p>Đã thêm @Transactional vì có thể tự động sinh và lưu mã liên kết phụ huynh (lazy initialization).
     *
     * @param me user từ JWT context
     * @return ProfileResponse đầy đủ thông tin
     * @throws ResourceNotFoundException nếu profile chưa tồn tại (lỗi sync
     *         hiếm gặp - auth user có nhưng profile chưa được tạo)
     */
    @Transactional
    public ProfileResponse getCurrentProfile(AuthenticatedUser me) {
        Profile profile = loadProfileOrThrow(me.userId());
        return ProfileResponse.fromEntity(profile, me.email());
    }


    // ========================================================================
    // PUT /api/me - cập nhật hồ sơ (UC05)
    // ========================================================================

    /**
     * Cập nhật thông tin cá nhân.
     *
     * <p>Field nào null trong request → giữ nguyên giá trị cũ (xem
     * {@link Profile#updatePersonalInfo}). Hibernate tự update
     * {@code updated_at} qua {@code @UpdateTimestamp}.
     *
     * @param me      user từ JWT context
     * @param request DTO đã pass Jakarta Validation
     * @return Profile sau khi cập nhật
     */
    @Transactional
    public ProfileResponse updateProfile(AuthenticatedUser me, UpdateProfileRequest request) {
        Profile profile = loadProfileOrThrow(me.userId());

        // Rich Domain Model: đẩy logic invariant vào entity
        profile.updatePersonalInfo(
                request.fullName(),
                request.phone(),
                request.bio(),
                request.twitterUrl(),
                request.facebookUrl(),
                request.linkedinUrl()
        );

        // Không cần gọi save() vì entity đã ở trong persistence context
        // (managed entity), Hibernate flush tự động ở cuối transaction.
        log.info("User {} cập nhật profile thành công", me.userId());
        return ProfileResponse.fromEntity(profile, me.email());
    }

    // ========================================================================
    // POST /api/me/avatar - upload ảnh đại diện
    // ========================================================================

    /**
     * Upload avatar và cập nhật URL vào profile.
     *
     * <p>Luồng:
     * <ol>
     *   <li>Validate file (MIME, size).</li>
     *   <li>Sinh path duy nhất: {@code {userId}/{timestamp}.{ext}}.</li>
     *   <li>Gọi {@link SupabaseStorageClient#upload} → nhận public URL.</li>
     *   <li>Cập nhật {@code profile.avatar_url}.</li>
     * </ol>
     *
     * <p>Vì sao đặt timestamp trong tên file: tránh CDN cache lại URL cũ
     * khi user đổi avatar (mỗi lần upload là URL mới hoàn toàn).
     *
     * @param me   user từ JWT context
     * @param file file ảnh client gửi qua multipart/form-data
     * @return Profile sau khi cập nhật avatar_url
     */
    @Transactional
    public ProfileResponse uploadAvatar(AuthenticatedUser me, MultipartFile file) {
        validateAvatarFile(file);

        Profile profile = loadProfileOrThrow(me.userId());
        String objectPath = buildAvatarPath(me.userId(), file.getContentType());

        // Đọc bytes - với file nhỏ (≤2MB) đọc thẳng vào memory là hợp lý.
        // Nếu sau này hỗ trợ file lớn, đổi sang streaming InputStream.
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            log.error("Không đọc được nội dung file upload", ex);
            throw new BusinessException("FILE_READ_ERROR",
                    "Không đọc được file. Vui lòng thử lại.",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        String publicUrl = storageClient.upload(
                AVATAR_BUCKET, objectPath, file.getContentType(), bytes);

        // Cập nhật entity - Rich Domain method đảm bảo chỉ thay đổi qua API hợp lệ
        profile.changeAvatar(publicUrl);
        log.info("User {} cập nhật avatar -> {}", me.userId(), publicUrl);

        return ProfileResponse.fromEntity(profile, me.email());
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    /**
     * Load profile hoặc ném 404.
     *
     * <p>Trường hợp profile thiếu chỉ xảy ra khi register có lỗi giữa chừng
     * (auth user tạo xong nhưng profile insert fail). Cần cron clean orphan
     * sau, nhưng ở đây phải trả lỗi rõ ràng cho user.
     */
    private Profile loadProfileOrThrow(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));
    }

    /**
     * Validate file avatar về MIME type và kích thước.
     * Ném {@link BusinessException} với code cụ thể để frontend hiển thị đúng.
     */
    private void validateAvatarFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "Vui lòng chọn file ảnh");
        }
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !ALLOWED_AVATAR_MIME.contains(contentType)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WEBP");
        }
        if (file.getSize() > MAX_AVATAR_SIZE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File ảnh không được vượt quá 2MB");
        }
    }

    /**
     * Build path object trong bucket avatars.
     *
     * <p>Format: {@code {userId}/{epochMillis}.{ext}}. Mỗi user có folder
     * riêng → tiện cleanup khi xoá tài khoản. Timestamp đảm bảo URL không
     * bị cache cũ ở CDN.
     *
     * <p>Lưu ý: KHÔNG dùng tên file gốc của client (có thể chứa ký tự
     * nguy hiểm như {@code ../}) - sinh tên hoàn toàn ở server.
     */
    private String buildAvatarPath(UUID userId, String contentType) {
        String extension = switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png"  -> "png";
            case "image/webp" -> "webp";
            default -> throw new BusinessException("INVALID_FILE_TYPE",
                    "Định dạng file không hỗ trợ");
        };
        return userId + "/" + Instant.now().toEpochMilli() + "." + extension;
    }
}
