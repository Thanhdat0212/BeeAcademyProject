package com.beeacademy.backend.service;

import com.beeacademy.backend.client.AuthProviderClient;
import com.beeacademy.backend.client.dto.ProviderTokenResponse;
import com.beeacademy.backend.client.dto.ProviderUser;
import com.beeacademy.backend.dto.request.ChangePasswordRequest;
import com.beeacademy.backend.dto.request.LoginRequest;
import com.beeacademy.backend.dto.request.OAuthSyncRequest;
import com.beeacademy.backend.dto.request.RegisterRequest;
import com.beeacademy.backend.dto.request.RequestOtpRequest;
import com.beeacademy.backend.dto.request.VerifyOtpRequest;
import com.beeacademy.backend.dto.response.AuthTokenResponse;
import com.beeacademy.backend.dto.response.UserSummaryResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Tầng nghiệp vụ cho phân hệ Auth (UC01–UC04).
 *
 * <p>Đây là Single Source of Truth cho mọi luật xác thực:
 * <ul>
 *   <li>Quy định role nào được đăng ký công khai.</li>
 *   <li>Đảm bảo profile được tạo cùng lúc với auth user (transactional).</li>
 *   <li>Quyết định message trả về (chống enumeration cho reset password).</li>
 * </ul>
 *
 * <p>Class này KHÔNG biết HTTP - chỉ nhận DTO request, gọi client/repository,
 * trả DTO response. Controller phía trên đảm nhận việc bind HTTP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthProviderClient authProviderClient;
    private final ProfileRepository profileRepository;
    private final OtpService otpService;

    // ========================================================================
    // UC01 - Đăng ký
    // ========================================================================

    /**
     * Đăng ký tài khoản mới.
     *
     * <p>Luồng:
     * <ol>
     *   <li>Validate role thuộc nhóm được đăng ký công khai (DTO đã chặn ở
     *       regex, nhưng check thêm ở tầng service để phòng thủ chiều sâu).</li>
     *   <li>Gọi provider tạo auth user → nhận UUID.</li>
     *   <li>INSERT row vào {@code profiles} với cùng UUID.</li>
     *   <li>Trả về thông tin user + message hướng dẫn xác thực email.</li>
     * </ol>
     *
     * <p>{@code @Transactional} - nếu bước 3 fail, exception sẽ rollback,
     * NHƯNG auth user ở Supabase đã được tạo (không thể rollback HTTP).
     * Đây là vấn đề "saga" cần xử lý: hiện tại chỉ log warning + ném lỗi,
     * sau này có thể thêm cron quét {@code auth.users} không có profile
     * tương ứng để xoá.
     *
     * @param request DTO đã pass validation
     * @return Thông tin user vừa tạo (chưa có token vì cần xác thực email)
     */
    @Transactional
    public UserSummaryResponse register(RegisterRequest request) {
        UserRole role = UserRole.fromDbValue(request.role());

        // Phòng thủ chiều sâu: chặn admin/teacher dù DTO đã regex chỉ student|parent
        if (role == null || !role.isAllowedForPublicSignup()) {
            throw new BusinessException("INVALID_ROLE",
                    "Vai trò không hợp lệ cho đăng ký công khai");
        }

        // Metadata gửi Supabase - lưu vào user_metadata, đọc lại được qua JWT claim
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("role", role.toDbValue());
        metadata.put("full_name", request.fullName());

        // Bước 1: tạo auth user bên Supabase
        ProviderUser providerUser = authProviderClient.signUp(
                request.email(), request.password(), metadata);
        log.info("Đã tạo auth user {} qua Supabase", providerUser.id());

        // Bước 2: tạo profile cùng UUID
        Profile profile = Profile.createNew(providerUser.id(), role, request.fullName());
        profileRepository.save(profile);
        log.info("Đã tạo profile {} cho user {}", profile.getId(), providerUser.email());

        return UserSummaryResponse.fromProfile(profile, providerUser.email());
    }

    // ========================================================================
    // UC01 bước 1 - Gửi OTP (luồng mới thay register trực tiếp)
    // ========================================================================

    /**
     * Validate role và gửi OTP 6 số đến email.
     * Chưa tạo tài khoản — chỉ lưu thông tin tạm + gửi mail.
     */
    public void requestOtp(RequestOtpRequest request) {
        UserRole role = UserRole.fromDbValue(request.role());
        if (role == null || !role.isAllowedForPublicSignup()) {
            throw new BusinessException("INVALID_ROLE",
                    "Vai trò không hợp lệ cho đăng ký công khai");
        }

        // Chặn ngay từ bước gửi OTP nếu email đã có tài khoản — tránh user nhận mã,
        // nhập OTP xong mới bị Supabase báo trùng email ở bước verify (UX tệ + tốn 1 email).
        if (profileRepository.existsByEmailInAuth(request.email())) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS",
                    "Email này đã được đăng ký", HttpStatus.CONFLICT);
        }

        otpService.send(request.email(), request.fullName(), request.role());
    }

    // ========================================================================
    // UC01 bước 2 - Xác minh OTP và tạo tài khoản
    // ========================================================================

    /**
     * Xác minh OTP, tạo auth user Supabase và profile.
     *
     * @return thông tin user vừa tạo
     */
    @Transactional
    public UserSummaryResponse verifyOtpAndRegister(VerifyOtpRequest request) {
        // Bước 1: validate OTP (chưa xóa — giữ lại để user retry nếu Supabase lỗi)
        OtpService.OtpEntry entry = otpService.verify(request.email(), request.otp());

        UserRole role = UserRole.fromDbValue(entry.role());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("role", role.toDbValue());
        metadata.put("full_name", entry.fullName());

        // Bước 2: tạo auth user qua Supabase Admin API (email_confirm=true, bỏ qua email Supabase)
        ProviderUser providerUser = authProviderClient.signUp(
                request.email(), request.password(), metadata);
        log.info("Đã tạo auth user {} sau xác minh OTP", providerUser.id());

        // Bước 3: tạo profile trong DB
        Profile profile = Profile.createNew(providerUser.id(), role, entry.fullName());
        profileRepository.save(profile);

        // Bước 4: OTP đã dùng xong, xóa khỏi store (single-use)
        otpService.consume(request.email());

        return UserSummaryResponse.fromProfile(profile, providerUser.email());
    }

    // ========================================================================
    // UC02 - Đăng nhập
    // ========================================================================

    /**
     * Đăng nhập, nhận access_token + refresh_token.
     *
     * <p>Mật khẩu/email đúng-sai do Supabase quyết định (client map lỗi đó
     * thành {@code INVALID_CREDENTIALS}); khóa tạm sau 5 lần sai liên tiếp
     * trong 15 phút (REQ-AUTH-002) là luật riêng của Bee Academy, xử lý ở
     * đây vì Supabase không có khái niệm này.
     */
    public AuthTokenResponse login(LoginRequest request) {
        Profile profile = profileRepository.findUserIdByEmail(request.email())
                .flatMap(profileRepository::findById)
                .orElse(null);

        if (profile != null && profile.isTemporarilyLocked()) {
            throw new BusinessException("ACCOUNT_TEMP_LOCKED",
                    "Tài khoản tạm khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau.",
                    HttpStatus.FORBIDDEN);
        }

        ProviderTokenResponse tokens;
        try {
            tokens = authProviderClient.signInWithPassword(request.email(), request.password());
        } catch (BusinessException ex) {
            if (profile != null && "INVALID_CREDENTIALS".equals(ex.getCode())) {
                profile.registerFailedLogin();
                profileRepository.save(profile);
            }
            throw ex;
        }

        if (profile != null && profile.getFailedLoginAttempts() > 0) {
            profile.resetFailedLogin();
            profileRepository.save(profile);
        }

        log.info("User {} đăng nhập thành công", request.email());
        return enrichAuthTokenResponse(tokens);
    }

    // ========================================================================
    // UC03 - Đăng xuất
    // ========================================================================

    /**
     * Đăng xuất - revoke refresh_token. Access_token vẫn sống đến hết TTL
     * (giới hạn của Supabase, frontend phải tự xoá khỏi storage).
     *
     * @param accessToken JWT user đang dùng (controller lấy từ header)
     */
    public void logout(String accessToken) {
        authProviderClient.signOut(accessToken);
    }

    // ========================================================================
    // Refresh token
    // ========================================================================

    /**
     * Đổi refresh_token lấy access_token mới.
     */
    public AuthTokenResponse refresh(String refreshToken) {
        ProviderTokenResponse tokens = authProviderClient.refreshToken(refreshToken);
        return enrichAuthTokenResponse(tokens);
    }

    /**
     * Bổ sung thông tin từ bảng profiles (avatarUrl, fullName, role) vào token response.
     * Supabase GoTrue không lưu avatarUrl nên ta cần map từ DB local.
     */
    private AuthTokenResponse enrichAuthTokenResponse(ProviderTokenResponse tokens) {
        AuthTokenResponse base = AuthTokenResponse.fromProvider(tokens);
        if (base.user() != null) {
            var profileOpt = profileRepository.findById(base.user().id());
            if (profileOpt.isPresent()) {
                var profile = profileOpt.get();
                var enrichedUser = new UserSummaryResponse(
                        base.user().id(),
                        base.user().email(),
                        profile.getRole() != null ? profile.getRole().toDbValue() : base.user().role(),
                        profile.getFullName() != null ? profile.getFullName() : base.user().fullName(),
                        profile.getAvatarUrl(),
                        profile.isMustChangePassword()
                );
                return new AuthTokenResponse(
                        base.accessToken(),
                        base.refreshToken(),
                        base.expiresIn(),
                        base.tokenType(),
                        enrichedUser
                );
            }
        }
        return base;
    }

    // ========================================================================
    // UC04 - Quên mật khẩu
    // ========================================================================

    /**
     * Gửi email reset password.
     *
     * <p>Luôn trả thành công bất kể email tồn tại hay không -
     * <b>anti-enumeration</b>. Lỗi rate limit của Supabase vẫn được
     * propagate ra để user biết chờ.
     */
    public void sendPasswordReset(String email) {
        authProviderClient.sendPasswordRecovery(email);
        log.info("Đã gửi yêu cầu reset password cho {}", email);
    }

    /**
     * Bước 1: Gửi OTP phục hồi mật khẩu.
     *
     * <p><b>Anti-enumeration</b>: luôn trả thành công bất kể email có tồn tại hay không.
     * Nếu email không có trong hệ thống, log cảnh báo và return sớm — KHÔNG ném exception.
     * Điều này ngăn kẻ tấn công brute-force endpoint để dò danh sách email đã đăng ký.
     */
    public void requestPasswordResetOtp(String email) {
        if (!profileRepository.existsByEmailInAuth(email)) {
            log.warn("Reset password OTP yêu cầu cho email không tồn tại (bị bỏ qua): {}", email);
            return;
        }
        otpService.sendResetPasswordOtp(email);
    }

    /**
     * Bước 2: Xác minh OTP đặt lại mật khẩu và cập nhật mật khẩu mới qua Admin API.
     */
    @Transactional
    public void verifyOtpAndResetPassword(String email, String otp, String newPassword) {
        // 1. Xác thực mã OTP
        otpService.verifyResetPasswordOtp(email, otp);

        // 2. Tìm ID của người dùng từ email
        UUID userId = profileRepository.findUserIdByEmail(email)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND",
                        "Không tìm thấy tài khoản người dùng"));

        // 3. Tiến hành cập nhật mật khẩu mới
        authProviderClient.updatePasswordAsAdmin(userId, newPassword);

        // 4. User đã tự đặt mật khẩu riêng → gỡ ràng buộc mật khẩu tạm của Admin
        profileRepository.findById(userId)
                .filter(Profile::isMustChangePassword)
                .ifPresent(profile -> {
                    profile.clearMustChangePassword();
                    profileRepository.save(profile);
                });

        // 5. Xóa mã OTP sau khi dùng
        otpService.consumeResetPasswordOtp(email);
        log.info("Tài khoản {} đã đặt lại mật khẩu thành công qua OTP", email);
    }


    // ========================================================================
    // Đổi mật khẩu (yêu cầu JWT)
    // ========================================================================

    /**
     * Đổi mật khẩu cho user đang đăng nhập.
     *
     * <p>Luồng:
     * <ol>
     *   <li>Verify mật khẩu cũ bằng cách signin lại - nếu sai → ném
     *       {@code WRONG_CURRENT_PASSWORD}.</li>
     *   <li>Nếu cũ đúng, gọi GoTrue update password với JWT hiện tại.</li>
     * </ol>
     *
     * <p>Tại sao verify cũ bằng signin: GoTrue không có endpoint riêng cho
     * "verify password" - cách rẻ nhất là gọi {@code token?grant_type=password}
     * và xem có 200 không. Side effect: tạo thêm 1 session token cũng ok
     * (sẽ tự hết hạn).
     *
     * @param accessToken JWT của user hiện tại
     * @param email       email lấy từ JWT (controller truyền vào)
     * @param request     DTO chứa mật khẩu cũ + mới
     */
    // ========================================================================
    // Google OAuth sync
    // ========================================================================

    /**
     * Đảm bảo profile tồn tại cho Google OAuth user.
     * Idempotent: gọi nhiều lần với cùng userId đều an toàn.
     * Google user mặc định role STUDENT vì không qua luồng đăng ký thông thường.
     */
    @Transactional
    public UserSummaryResponse syncOAuthProfile(UUID userId, String email, OAuthSyncRequest request) {
        return profileRepository.findById(userId)
                .map(existing -> {
                    log.info("OAuth sync: profile {} đã tồn tại", userId);
                    return UserSummaryResponse.fromProfile(existing, email);
                })
                .orElseGet(() -> {
                    String fullName = (request != null) ? request.fullName() : null;
                    Profile profile = Profile.createNew(userId, UserRole.STUDENT, fullName);
                    if (request != null && request.avatarUrl() != null) {
                        profile.changeAvatar(request.avatarUrl());
                    }
                    profileRepository.save(profile);
                    log.info("OAuth sync: tạo profile mới {} cho Google user {}", userId, email);
                    return UserSummaryResponse.fromProfile(profile, email);
                });
    }

    public void changePassword(String accessToken, String email, ChangePasswordRequest request) {
        // Bước 1: verify mật khẩu cũ
        try {
            authProviderClient.signInWithPassword(email, request.currentPassword());
        } catch (BusinessException ex) {
            // Nếu signInWithPassword fail vì credentials → mật khẩu cũ sai
            if ("INVALID_CREDENTIALS".equals(ex.getCode())) {
                throw new BusinessException("WRONG_CURRENT_PASSWORD",
                        "Mật khẩu hiện tại không đúng", HttpStatus.BAD_REQUEST);
            }
            throw ex;
        }

        // Bước 2: chặn mật khẩu mới trùng cũ (UX tốt hơn là để Supabase trả lỗi)
        if (request.newPassword().equals(request.currentPassword())) {
            throw new BusinessException("PASSWORD_NOT_CHANGED",
                    "Mật khẩu mới phải khác mật khẩu hiện tại");
        }

        // Bước 3: gọi GoTrue update
        authProviderClient.updatePassword(accessToken, request.newPassword());

        // Bước 4: user đã tự đặt mật khẩu riêng → gỡ ràng buộc "phải đổi mật khẩu
        // tạm" nếu tài khoản này do Admin cấp (xem AdminTeacherAccountService).
        profileRepository.findUserIdByEmail(email)
                .flatMap(profileRepository::findById)
                .filter(Profile::isMustChangePassword)
                .ifPresent(profile -> {
                    profile.clearMustChangePassword();
                    profileRepository.save(profile);
                });

        log.info("User {} đã đổi mật khẩu", email);
    }
}
