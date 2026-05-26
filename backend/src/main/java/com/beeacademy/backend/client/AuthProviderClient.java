package com.beeacademy.backend.client;

import com.beeacademy.backend.client.dto.ProviderTokenResponse;
import com.beeacademy.backend.client.dto.ProviderUser;

import java.util.Map;
import java.util.UUID;

/**
 * Abstraction cho nhà cung cấp auth bên ngoài (hiện tại = Supabase GoTrue,
 * tương lai có thể swap sang Cognito / Auth0).
 *
 * <p>Tách interface khỏi impl giúp:
 * <ul>
 *   <li>{@code AuthService} chỉ phụ thuộc abstraction → tuân thủ DIP.</li>
 *   <li>Unit test {@code AuthService} bằng mock client - không cần spin
 *       Supabase thật.</li>
 *   <li>Đổi provider chỉ cần viết impl mới, không sửa service/controller.</li>
 * </ul>
 *
 * <p>Mọi method ném {@link com.beeacademy.backend.exception.BusinessException}
 * khi gặp lỗi nghiệp vụ (email tồn tại, sai password, v.v.) - tầng dưới
 * tự normalize lỗi của provider thành code chuẩn của hệ thống.
 */
public interface AuthProviderClient {

    /**
     * Đăng ký tài khoản mới.
     *
     * @param email    email user
     * @param password mật khẩu raw (provider tự hash)
     * @param metadata dữ liệu kèm theo lưu vào user_metadata (role, full_name)
     * @return ProviderUser - chứa id đã được provider gán
     */
    ProviderUser signUp(String email, String password, Map<String, Object> metadata);

    /**
     * Đăng nhập bằng email + password, nhận token.
     *
     * @return token + thông tin user
     */
    ProviderTokenResponse signInWithPassword(String email, String password);

    /**
     * Lấy access_token mới từ refresh_token.
     */
    ProviderTokenResponse refreshToken(String refreshToken);

    /**
     * Revoke session hiện tại (chỉ vô hiệu refresh_token, access_token
     * vẫn sống đến hết TTL).
     *
     * @param accessToken JWT đang dùng - dùng để provider biết session nào
     */
    void signOut(String accessToken);

    /**
     * Gửi email reset password tới {@code email}.
     *
     * <p>Provider không cho biết email có tồn tại không (anti-enumeration)
     * → method này luôn "success" miễn là call HTTP thành công.
     */
    void sendPasswordRecovery(String email);

    /**
     * Đổi mật khẩu cho user đang đăng nhập (xác định qua accessToken).
     *
     * @param accessToken JWT của user
     * @param newPassword mật khẩu mới
     */
    void updatePassword(String accessToken, String newPassword);

    /**
     * Cập nhật mật khẩu cho user chỉ định bằng quyền Admin (dùng service_role_key).
     *
     * @param userId      UUID của user cần đổi mật khẩu
     * @param newPassword mật khẩu mới
     */
    void updatePasswordAsAdmin(UUID userId, String newPassword);
}
