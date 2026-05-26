/**
 * ============================================================================
 *  useAuthStore - Zustand store cho xác thực & user info
 * ----------------------------------------------------------------------------
 *  Thay đổi so với version mock cũ:
 *    - Thêm accessToken / refreshToken (do BE Spring Boot phát hành).
 *    - Bọc persist middleware → token + user sống qua F5 reload.
 *    - Default isLoggedIn = false (không còn hardcode true).
 *    - Action loginWithTokens(payload) thay cho login(user?) - tách rõ
 *      việc "đã có token thật" với "mock login UI".
 *
 *  CẢNH BÁO BẢO MẬT:
 *    Lưu access_token trong localStorage tiện cho dev nhưng có rủi ro XSS.
 *    Production nên đổi sang httpOnly cookie do BE set (cần CORS preflight
 *    + sameSite). Phiên bản này dùng localStorage cho đơn giản giai đoạn 1C.
 * ============================================================================
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokenPayload, UserSummary } from '../types/api';

// ---------------------------------------------------------------------------
//  Type
// ---------------------------------------------------------------------------

/**
 * Type User dùng nội bộ UI (Header dropdown, ProfilePage...).
 * Tách khỏi UserSummary của API để giữ field optional `avatar` cho fallback
 * ui-avatars.com khi BE chưa trả URL.
 */
export interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  // ----- State -----
  isLoggedIn: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // ----- Actions -----
  /**
   * Lưu token + user sau khi gọi authService.login() / register() thành công.
   * `user` chấp nhận shape UserSummary từ API, store tự map sang User UI.
   */
  loginWithTokens: (payload: AuthTokenPayload) => void;

  /** Cập nhật user info (sau khi PUT /api/me). */
  updateUser: (partial: Partial<User>) => void;

  /** Xoá toàn bộ state - gọi sau khi authService.logout(). */
  logout: () => void;
}

// ---------------------------------------------------------------------------
//  Helper: map UserSummary (API) → User (UI)
// ---------------------------------------------------------------------------

function toUiUser(summary: UserSummary | null): User | null {
  if (!summary) return null;
  return {
    name: summary.fullName ?? summary.email,
    email: summary.email,
    avatar: summary.avatarUrl ?? undefined,
  };
}

// ---------------------------------------------------------------------------
//  Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Default: chưa đăng nhập. Sau khi user gọi loginWithTokens mới set true.
      isLoggedIn: false,
      user: null,
      accessToken: null,
      refreshToken: null,

      loginWithTokens: (payload) =>
        set({
          isLoggedIn: true,
          user: toUiUser(payload.user),
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () =>
        set({
          isLoggedIn: false,
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      // Key trong localStorage - đặt prefix bee-academy để tránh đụng app khác
      name: 'bee-academy-auth',
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist field cần thiết, không bao gồm các action
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
