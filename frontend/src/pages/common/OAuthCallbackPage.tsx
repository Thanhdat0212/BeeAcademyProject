import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { unwrap } from '../../api/client';
import { notify } from '../../lib/toast';
import { resolveRoleHome } from '../../lib/utils';
import type { ApiResponse, AuthTokenPayload, UserSummary } from '../../types/api';

function parseHash(hash: string): Record<string, string> {
  return hash.replace(/^#/, '').split('&').reduce<Record<string, string>>((acc, pair) => {
    const [k, v] = pair.split('=');
    if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    return acc;
  }, {});
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const loginWithTokens = useAuthStore((s) => s.loginWithTokens);

  // useRef thay vì useState để tránh React StrictMode double-invoke.
  // Lý do: React StrictMode mount → unmount → remount component trong dev.
  // Nếu dùng useState(false), cả 2 lần mount đều thấy processed=false trước khi
  // set chạy → effect chạy 2 lần → 2 lần gọi /api/auth/oauth/sync → race condition.
  // useRef.current được ghi nhận ngay (không qua render cycle) nên lần mount thứ 2
  // thấy processed.current = true và thoát sớm.
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    (async () => {
      const params = parseHash(window.location.hash);
      const { access_token, refresh_token, expires_in, error, error_description } = params;

      if (error) {
        notify.error(error_description ?? 'Đăng nhập Google thất bại.');
        navigate('/login', { replace: true });
        return;
      }

      if (!access_token || !refresh_token) {
        notify.error('Phản hồi OAuth không hợp lệ. Vui lòng thử lại.');
        navigate('/login', { replace: true });
        return;
      }

      try {
        const jwtPayload = decodeJwtPayload(access_token);
        const meta = (jwtPayload['user_metadata'] ?? {}) as Record<string, unknown>;
        const fullName = typeof meta['full_name'] === 'string' ? meta['full_name'] : null;
        const avatarUrl = typeof meta['avatar_url'] === 'string' ? meta['avatar_url'] : null;

        // Dùng axios instance riêng — tránh request interceptor ghi đè token
        // bằng token cũ còn trong Zustand store (từ session trước)
        const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8080';
        const oauthClient = axios.create({
          baseURL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`,
          },
        });
        const res = await oauthClient.post<ApiResponse<UserSummary>>('/api/auth/oauth/sync', { fullName, avatarUrl });
        const user = unwrap(res.data);

        const tokenPayload: AuthTokenPayload = {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: parseInt(expires_in ?? '3600', 10),
          tokenType: 'bearer',
          user,
        };
        loginWithTokens(tokenPayload);
        notify.success('Đăng nhập Google thành công!');
        // Điều hướng theo role thay vì cố định /courses — GV/Admin/PH vào đúng dashboard.
        navigate(resolveRoleHome(user.role), { replace: true });
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message ?? 'Đăng nhập Google thất bại.'
          : 'Đăng nhập Google thất bại. Vui lòng thử lại.';
        notify.error(msg);
        navigate('/login', { replace: true });
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-on-surface-variant font-medium">Đang hoàn tất đăng nhập...</p>
      </motion.div>
    </div>
  );
}
