/**
 * ============================================================================
 *  authService - gọi các endpoint /api/auth/* của backend Spring Boot
 * ----------------------------------------------------------------------------
 *  Component KHÔNG được gọi axios trực tiếp. Mọi tương tác auth đi qua
 *  service này để:
 *    - Tách concerns: component chỉ lo UI, service lo HTTP.
 *    - Dễ swap impl (vd: mock cho test, fetch cho RSC).
 *    - Có chỗ tập trung để log / retry / circuit-breaker sau này.
 * ============================================================================
 */
import { apiClient, unwrap } from './client';
import type {
  ApiResponse,
  AuthTokenPayload,
  LoginPayload,
  OAuthSyncPayload,
  ProfileDetail,
  RegisterPayload,
  RequestOtpPayload,
  RequestResetPasswordOtpPayload,
  UserSummary,
  VerifyOtpPayload,
  VerifyResetPasswordOtpPayload,
} from '../types/api';

// ---------------------------------------------------------------------------
//  UC01 - Đăng ký
// ---------------------------------------------------------------------------

/**
 * Đăng ký tài khoản mới.
 *
 * Backend mặc định bật email confirm → response KHÔNG kèm token. User phải
 * click link trong email rồi mới login được.
 *
 * @returns Thông tin user vừa tạo (id, email, role, fullName, avatarUrl).
 */
export async function register(payload: RegisterPayload): Promise<UserSummary> {
  const res = await apiClient.post<ApiResponse<UserSummary>>(
    '/api/auth/register',
    payload,
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  UC01 OTP - Gửi mã + Xác minh mã
// ---------------------------------------------------------------------------

/** Bước 1: Gửi OTP đến email (chưa tạo tài khoản). */
export async function requestOtp(payload: RequestOtpPayload): Promise<void> {
  await apiClient.post('/api/auth/register/request-otp', payload);
}

/** Bước 2: Xác minh OTP và hoàn tất đăng ký. */
export async function verifyOtp(payload: VerifyOtpPayload): Promise<UserSummary> {
  const res = await apiClient.post<ApiResponse<UserSummary>>(
    '/api/auth/register/verify-otp',
    payload,
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  UC02 - Đăng nhập
// ---------------------------------------------------------------------------

/**
 * Đăng nhập, trả access_token + refresh_token + user.
 * Caller nên truyền payload xuống `useAuthStore.loginWithTokens(payload)`
 * để store lưu lại + persist.
 */
export async function login(payload: LoginPayload): Promise<AuthTokenPayload> {
  const res = await apiClient.post<ApiResponse<AuthTokenPayload>>(
    '/api/auth/login',
    payload,
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  UC03 - Đăng xuất
// ---------------------------------------------------------------------------

/**
 * Revoke refresh_token ở backend. Caller cần gọi
 * `useAuthStore.logout()` để xoá state phía FE (interceptor đã set sẵn
 * Authorization header từ store).
 */
export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}

// ---------------------------------------------------------------------------
//  Refresh access_token
// ---------------------------------------------------------------------------

export async function refresh(refreshToken: string): Promise<AuthTokenPayload> {
  const res = await apiClient.post<ApiResponse<AuthTokenPayload>>(
    '/api/auth/refresh',
    { refreshToken },
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  UC04 - Quên mật khẩu (gửi email reset)
// ---------------------------------------------------------------------------

/**
 * Backend luôn trả 200 dù email tồn tại hay không (anti-enumeration).
 * Caller chỉ cần hiển thị message chung "Đã gửi nếu email tồn tại".
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/api/auth/reset-password', { email });
}

/** Yêu cầu gửi mã OTP quên mật khẩu về Email. */
export async function requestPasswordResetOtp(payload: RequestResetPasswordOtpPayload): Promise<void> {
  await apiClient.post('/api/auth/reset-password/request-otp', payload);
}

/** Xác minh mã OTP quên mật khẩu và đặt lại mật khẩu mới. */
export async function verifyPasswordResetOtp(payload: VerifyResetPasswordOtpPayload): Promise<void> {
  await apiClient.post('/api/auth/reset-password/verify-otp', payload);
}


// ---------------------------------------------------------------------------
//  Đổi mật khẩu (yêu cầu JWT)
// ---------------------------------------------------------------------------

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

// ---------------------------------------------------------------------------
//  Profile (UC05) - tiện nhóm chung với auth
// ---------------------------------------------------------------------------

/** GET /api/me - lấy profile user đang đăng nhập. */
export async function getMyProfile(): Promise<ProfileDetail> {
  const res = await apiClient.get<ApiResponse<ProfileDetail>>('/api/me');
  return unwrap(res.data);
}

/** PUT /api/me - cập nhật hồ sơ. Field null = giữ nguyên. */
export async function updateMyProfile(payload: Partial<{
  fullName: string;
  phone: string;
  bio: string;
  twitterUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
}>): Promise<ProfileDetail> {
  const res = await apiClient.put<ApiResponse<ProfileDetail>>('/api/me', payload);
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  Google OAuth sync
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/oauth/sync - đồng bộ profile sau khi Google OAuth thành công.
 * Tạo profile mới nếu chưa có, hoặc trả về profile hiện có.
 * Yêu cầu Bearer token được set trước khi gọi.
 */
export async function syncOAuthProfile(payload: OAuthSyncPayload): Promise<UserSummary> {
  const res = await apiClient.post<ApiResponse<UserSummary>>('/api/auth/oauth/sync', payload);
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------

/**
 * POST /api/me/avatar - upload ảnh đại diện qua multipart/form-data.
 * Backend validate MIME (jpeg/png/webp) + size ≤ 2MB.
 */
export async function uploadAvatar(file: File): Promise<ProfileDetail> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<ApiResponse<ProfileDetail>>(
    '/api/me/avatar',
    formData,
    {
      headers: {
        // Để axios tự set boundary cho multipart - đừng hardcode Content-Type
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return unwrap(res.data);
}
