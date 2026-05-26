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
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { notify } from '../lib/toast';
import type { ApiErrorResponse, ApiResponse } from '../types/api';

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

/**
 * Track flag để chỉ logout + redirect 1 lần khi 401 dù có nhiều request đồng
 * thời cùng fail. Reset khi route /login load lại.
 */
let isHandling401 = false;

apiClient.interceptors.response.use(
  // 2xx: pass through, component nhận response.data
  (response) => response,
  // Lỗi: chuẩn hoá thành Error có message tiếng Việt
  (error: AxiosError<ApiErrorResponse>) => {
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

    // 401 toàn cục: token sai/hết hạn → đẩy về /login
    if (status === 401 && !isHandling401) {
      isHandling401 = true;
      useAuthStore.getState().logout();
      notify.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      // Redirect dùng window.location vì interceptor không có access React Router
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href =
          '/login?from=' + encodeURIComponent(currentPath);
      }
      // Reset flag sau 2s phòng trường hợp user back/forward
      setTimeout(() => {
        isHandling401 = false;
      }, 2000);
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
