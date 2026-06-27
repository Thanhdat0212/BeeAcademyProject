/**
 * ============================================================================
 *  Bee Academy - Axios Client
 * ----------------------------------------------------------------------------
 *  Single instance dùng chung toàn frontend.
 *
 *  Interceptor:
 *    1. REQUEST  - tự đính kèm Authorization: Bearer <token> nếu store có token.
 *    2. RESPONSE - bắt 401 toàn cục: logout + toast + redirect /login.
 *                - bắt 4xx/5xx khác: bóc ApiErrorResponse, ném ra promise reject
 *                  với message tiếng Việt để service / component hiển thị.
 *
 *  KHÔNG cho component import axios trực tiếp - phải gọi qua service ở
 *  src/api/<X>Service.ts để tách concerns.
 * ============================================================================
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { notify } from '../lib/toast';
import type {
  ApiErrorResponse,
  ApiResponse,
  AuthTokenPayload,
} from '../types/api';

// ----------------------------------------------------------------------------
//  Tạo axios instance
// ----------------------------------------------------------------------------

/**
 * Lấy base URL từ Vite env. Fallback localhost cho dev nếu thiếu .env.local.
 *
 * `import.meta.env` là tính năng của Vite (KHÔNG phải Webpack/CRA), bind các
 * biến VITE_* lúc build. Không có VITE_API_BASE_URL → fallback an toàn.
 */
const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8080';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15s - đủ cho hầu hết REST call; upload file dùng config riêng.
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ----------------------------------------------------------------------------
//  Request interceptor - đính kèm JWT
// ----------------------------------------------------------------------------

/**
 * Mỗi outgoing request đi qua đây. Đọc token từ Zustand store (KHÔNG dùng
 * localStorage trực tiếp vì store đã handle persist + sync nhiều tab).
 *
 * Endpoint public (/api/courses, /api/auth/*) gửi kèm token cũng vô hại -
 * backend bỏ qua nếu route không yêu cầu auth.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ----------------------------------------------------------------------------
//  Response interceptor - chuẩn hoá error + handle 401
// ----------------------------------------------------------------------------

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Các request cùng nhận 401 sẽ dùng chung một lần refresh thay vì tự refresh/logout.
let refreshPromise: Promise<AuthTokenPayload> | null = null;
let isHandling401 = false;

const PUBLIC_AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/refresh',
];

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some(path => url === path || url.startsWith(`${path}/`));
}

function getRequestBearerToken(config?: InternalAxiosRequestConfig): string | null {
  const authorization = config?.headers?.get('Authorization');
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length);
}

async function refreshAccessToken(refreshToken: string): Promise<AuthTokenPayload> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiResponse<AuthTokenPayload>>(
        `${BASE_URL}/api/auth/refresh`,
        { refreshToken },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      )
      .then(response => response.data.data)
      .then(payload => {
        const currentSession = useAuthStore.getState();
        // Không cho request refresh cũ khôi phục phiên sau khi user đã logout
        // hoặc đăng nhập sang tài khoản khác trong lúc request đang chạy.
        if (
          !currentSession.isLoggedIn ||
          currentSession.refreshToken !== refreshToken
        ) {
          throw new Error('AUTH_SESSION_CHANGED');
        }
        currentSession.refreshSession(payload);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function expireSession(): void {
  if (isHandling401) return;
  isHandling401 = true;
  useAuthStore.getState().logout();
  notify.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const currentPath = window.location.pathname;
  if (currentPath !== '/login') {
    window.location.assign(`/login?from=${encodeURIComponent(currentPath)}`);
  }
}

apiClient.interceptors.response.use(
  // 2xx: pass through, component nhận response.data
  (response) => response,
  // Lỗi: chuẩn hoá thành Error có message tiếng Việt
  async (error: AxiosError<ApiErrorResponse>) => {
    // Trường hợp network (server down, CORS, timeout)
    if (!error.response) {
      const offline = !navigator.onLine;
      const msg = offline
        ? 'Mất kết nối Internet. Vui lòng kiểm tra mạng.'
        : 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.';
      notify.error(msg);
      return Promise.reject(new Error(msg));
    }

    const status = error.response.status;
    const body = error.response.data;
    const message = body?.message ?? 'Đã xảy ra lỗi không xác định';
    const code = body?.code ?? 'UNKNOWN';

    if (status === 401 && error.config && !isPublicAuthRequest(error.config.url)) {
      const originalRequest = error.config as RetryableRequestConfig;
      const authState = useAuthStore.getState();

      if (authState.isLoggedIn && authState.accessToken && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const requestToken = getRequestBearerToken(originalRequest);

          // Request của trang cũ trả về sau khi phiên đã được refresh:
          // thử lại ngay bằng token mới, không refresh/logout lần nữa.
          if (requestToken && requestToken !== authState.accessToken) {
            originalRequest.headers.set(
              'Authorization',
              `Bearer ${authState.accessToken}`,
            );
            return apiClient(originalRequest);
          }

          if (authState.refreshToken) {
            const refreshed = await refreshAccessToken(authState.refreshToken);
            originalRequest.headers.set(
              'Authorization',
              `Bearer ${refreshed.accessToken}`,
            );
            return apiClient(originalRequest);
          }
        } catch {
          // Refresh token thật sự không còn hợp lệ.
          const latestSession = useAuthStore.getState();
          if (
            latestSession.isLoggedIn &&
            latestSession.refreshToken === authState.refreshToken
          ) {
            expireSession();
          }
        }
      } else if (authState.isLoggedIn && !refreshPromise) {
        expireSession();
      }
    }

    // Tạo Error custom có thêm code + fieldErrors để component xử lý
    const wrapped: ApiError = Object.assign(new Error(message), {
      code,
      status,
      fieldErrors: body?.fieldErrors,
    });
    return Promise.reject(wrapped);
  },
);

// ----------------------------------------------------------------------------
//  Helper: unwrap ApiResponse<T> → T
// ----------------------------------------------------------------------------

/**
 * Backend luôn bọc data trong {success, message, data, timestamp}. Component
 * chỉ cần `data` → service dùng helper này để bóc gọn.
 *
 * Cách dùng trong service:
 *   const res = await apiClient.get<ApiResponse<CourseDetail>>(`/api/courses/${id}`);
 *   return unwrap(res.data);
 */
export function unwrap<T>(envelope: ApiResponse<T>): T {
  return envelope.data;
}

// ----------------------------------------------------------------------------
//  Error type mở rộng - service / component import để type-narrow
// ----------------------------------------------------------------------------

export interface ApiError extends Error {
  code: string;
  status: number;
  fieldErrors?: Array<{ field: string; message: string }>;
}

/** Type guard kiểm tra error có phải lỗi từ backend không. */
export function isApiError(e: unknown): e is ApiError {
  return e instanceof Error && 'code' in e && 'status' in e;
}
