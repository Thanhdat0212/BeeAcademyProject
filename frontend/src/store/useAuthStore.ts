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
import * as parentService from '../api/parentService';


// ---------------------------------------------------------------------------
//  Type
// ---------------------------------------------------------------------------

/**
 * Cấu trúc thông tin học sinh (con cái) liên kết với tài khoản Phụ huynh
 */
export interface LinkedStudent {
  id: string;
  name: string;
  avatar?: string;
  code: string;
  grade: string;
  avgProgress?: number;
  coursesCount?: { active: number; completed: number };
  recentScores?: { quiz: number; exam: number };
  weeklyActivity?: number[];
}

/**
 * Type User dùng nội bộ UI (Header dropdown, ProfilePage...).
 * Tách khỏi UserSummary của API để giữ field optional `avatar` cho fallback
 * ui-avatars.com khi BE chưa trả URL.
 */
export interface User {
  name: string;
  email: string;
  avatar?: string;
  role?: 'student' | 'parent' | 'teacher' | 'admin' | null;
}

interface AuthState {
  // ----- State -----
  isLoggedIn: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  linkedStudents: LinkedStudent[]; // Danh sách các con đã liên kết

  // ----- Actions -----
  /**
   * Lưu token + user sau khi gọi authService.login() / register() thành công.
   * `user` chấp nhận shape UserSummary từ API, store tự map sang User UI.
   */
  loginWithTokens: (payload: AuthTokenPayload) => void;

  /** Cập nhật token sau khi refresh, giữ nguyên dữ liệu phiên đang dùng. */
  refreshSession: (payload: AuthTokenPayload) => void;
 
  /** Cập nhật user info (sau khi PUT /api/me). */
  updateUser: (partial: Partial<User>) => void;
 
  /** Xoá toàn bộ state - gọi sau khi authService.logout(). */
  logout: () => void;

  /** Tải danh sách học sinh đã liên kết từ backend API */
  fetchLinkedStudents: () => Promise<void>;

  /** Gỡ liên kết học sinh */
  unlinkStudent: (studentId: string) => Promise<boolean | string>;
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
    role: summary.role,
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

      // Ban đầu danh sách con trống, sẽ được tải qua API fetchLinkedStudents
      linkedStudents: [],

      loginWithTokens: (payload) =>
        set({
          isLoggedIn: true,
          user: toUiUser(payload.user),
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          linkedStudents: [], // reset danh sách con khi login account mới
        }),

      refreshSession: (payload) =>
        set((state) => ({
          isLoggedIn: true,
          user: toUiUser(payload.user) ?? state.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        })),

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
          linkedStudents: [],
        }),

      fetchLinkedStudents: async () => {
        try {
          const list = await parentService.getLinkedChildren();
          const mapped = list.map((item) => ({
            id: item.id.toString(),
            name: item.name,
            avatar: item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=feb700&color=1a1b1e&bold=true&size=128`,
            code: item.code,
            grade: item.grade,
            avgProgress: 0,
            coursesCount: { active: 0, completed: 0 },
            recentScores: { quiz: 0, exam: 0 },
            weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
          }));
          set({ linkedStudents: mapped });
        } catch (error) {
          console.error('Lỗi khi tải danh sách con đã liên kết:', error);
        }
      },



      unlinkStudent: async (studentId) => {
        try {
          await parentService.unlinkStudent(studentId);
          // Xóa local
          set((state) => ({
            linkedStudents: state.linkedStudents.filter((s) => s.id !== studentId),
          }));
          return true;
        } catch (error: any) {
          return error?.message || 'Không thể gỡ liên kết tài khoản con.';
        }
      }
    }),
    {
      // Key trong localStorage - đặt prefix bee-academy để tránh đụng app khác
      name: 'bee-academy-auth',
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist field cần thiết, bao gồm cả linkedStudents của phụ huynh
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        linkedStudents: state.linkedStudents,
      }),
    },
  ),
);
