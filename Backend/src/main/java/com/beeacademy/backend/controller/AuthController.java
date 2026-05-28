package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ChangePasswordRequest;
import com.beeacademy.backend.dto.request.LoginRequest;
import com.beeacademy.backend.dto.request.OAuthSyncRequest;
import com.beeacademy.backend.dto.request.RefreshTokenRequest;
import com.beeacademy.backend.dto.request.RegisterRequest;
import com.beeacademy.backend.dto.request.RequestOtpRequest;
import com.beeacademy.backend.dto.request.RequestResetPasswordOtpRequest;
import com.beeacademy.backend.dto.request.ResetPasswordRequest;
import com.beeacademy.backend.dto.request.VerifyOtpRequest;
import com.beeacademy.backend.dto.request.VerifyResetPasswordOtpRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.AuthTokenResponse;
import com.beeacademy.backend.dto.response.UserSummaryResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller cho phân hệ Auth (UC01–UC04).
 *
 * <p>Triết lý "thin controller":
 * <ul>
 *   <li>Mỗi method chỉ 3–5 dòng: bind DTO → gọi service → wrap response.</li>
 *   <li>KHÔNG có if/else nghiệp vụ ở đây.</li>
 *   <li>KHÔNG có try/catch - exception đẩy lên {@code GlobalExceptionHandler}.</li>
 *   <li>Validation tự động qua {@code @Valid} trên request body.</li>
 * </ul>
 *
 * <p>Tất cả endpoint dưới {@code /api/auth/**} đều public (theo
 * {@code SecurityConfig}), trừ {@code change-password} và {@code logout}
 * cần JWT - được service tự verify thông qua {@link CurrentUser}.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * UC01 - Đăng ký tài khoản.
     * Trả 200 + thông tin user. User nhận email confirm trước khi login được.
     */
    @PostMapping("/register")
    public ApiResponse<UserSummaryResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserSummaryResponse user = authService.register(request);
        return ApiResponse.ok(user,
                "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.");
    }

    /**
     * UC01 bước 1 - Gửi OTP đến email để xác minh trước khi tạo tài khoản.
     */
    @PostMapping("/register/request-otp")
    public ApiResponse<Void> requestOtp(@Valid @RequestBody RequestOtpRequest request) {
        authService.requestOtp(request);
        return ApiResponse.ok(null,
                "Mã OTP đã được gửi đến " + request.email() + ". Hiệu lực 5 phút.");
    }

    /**
     * UC01 bước 2 - Xác minh OTP và hoàn tất tạo tài khoản.
     */
    @PostMapping("/register/verify-otp")
    public ApiResponse<UserSummaryResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        UserSummaryResponse user = authService.verifyOtpAndRegister(request);
        return ApiResponse.ok(user, "Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.");
    }

    /**
     * UC02 - Đăng nhập.
     * Trả access_token + refresh_token cho frontend lưu.
     */
    @PostMapping("/login")
    public ApiResponse<AuthTokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request), "Đăng nhập thành công");
    }

    /**
     * UC03 - Đăng xuất.
     *
     * <p>Lấy JWT từ header (chứ không phải từ {@link CurrentUser}, vì
     * cần raw token string để forward sang Supabase). Yêu cầu user đã
     * authenticate - nếu không, {@link CurrentUser#required} ném 401.
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest httpRequest) {
        CurrentUser.required();   // chỉ để đảm bảo có JWT hợp lệ
        String token = extractBearerToken(httpRequest);
        authService.logout(token);
        return ApiResponse.ok(null, "Đăng xuất thành công");
    }

    /**
     * Refresh access_token bằng refresh_token.
     */
    @PostMapping("/refresh")
    public ApiResponse<AuthTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request.refreshToken()));
    }

    /**
     * UC04 - Quên mật khẩu, gửi email reset.
     * Luôn trả message chung chung để chống enumeration.
     */
    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.sendPasswordReset(request.email());
        return ApiResponse.ok(null,
                "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
    }

    /**
     * UC04 bước 1 - Quên mật khẩu, gửi OTP đến email.
     */
    @PostMapping("/reset-password/request-otp")
    public ApiResponse<Void> requestResetPasswordOtp(
            @Valid @RequestBody RequestResetPasswordOtpRequest request) {
        authService.requestPasswordResetOtp(request.email());
        return ApiResponse.ok(null,
                "Mã OTP phục hồi mật khẩu đã được gửi đến " + request.email() + ". Hiệu lực 5 phút.");
    }

    /**
     * UC04 bước 2 - Xác minh OTP và đặt lại mật khẩu mới.
     */
    @PostMapping("/reset-password/verify-otp")
    public ApiResponse<Void> verifyResetPasswordOtp(
            @Valid @RequestBody VerifyResetPasswordOtpRequest request) {
        authService.verifyOtpAndResetPassword(request.email(), request.otp(), request.newPassword());
        return ApiResponse.ok(null, "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.");
    }


    /**
     * Đổi mật khẩu - yêu cầu JWT hợp lệ.
     *
     * <p>{@link CurrentUser#required} đảm bảo user đã authenticate.
     * Email lấy từ JWT claim (đã được filter trích sẵn vào
     * {@link AuthenticatedUser#email}).
     */
    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                            HttpServletRequest httpRequest) {
        AuthenticatedUser me = CurrentUser.required();
        String token = extractBearerToken(httpRequest);
        authService.changePassword(token, me.email(), request);
        return ApiResponse.ok(null, "Đổi mật khẩu thành công");
    }

    /**
     * Google OAuth sync - đảm bảo profile tồn tại sau khi Supabase xác thực.
     * Yêu cầu JWT hợp lệ trong header (từ Supabase OAuth callback).
     */
    @PostMapping("/oauth/sync")
    public ApiResponse<UserSummaryResponse> syncOAuth(
            @RequestBody(required = false) OAuthSyncRequest request) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(
                authService.syncOAuthProfile(me.userId(), me.email(), request),
                "Đồng bộ tài khoản Google thành công"
        );
    }

    // ========================================================================
    // Helper - tách token khỏi header Authorization
    // ========================================================================

    /**
     * Lấy phần token đứng sau "Bearer " trong header Authorization.
     * Nếu thiếu/sai prefix → trả null (service xử lý tiếp).
     */
    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        return header.substring("Bearer ".length()).trim();
    }
}
