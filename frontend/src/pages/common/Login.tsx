import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Lock } from 'lucide-react';
import { notify } from '../../lib/toast';
import { useAuthStore } from '../../store/useAuthStore';
import { login as loginApi } from '../../api/authService';
import { isApiError } from '../../api/client';

function buildGoogleOAuthUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: `${window.location.origin}/auth/callback`,
  });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const loginWithTokens = useAuthStore(state => state.loginWithTokens);

  // Đọc trang nguồn từ location.state — được truyền khi redirect sang login
  // Ví dụ: handleAddToCart() truyền { from: '/courses/abc' } khi chưa đăng nhập
  const redirectTo = (location.state as { from?: string })?.from ?? '/courses';

  const handleGoogleLogin = () => { window.location.href = buildGoogleOAuthUrl(); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      notify.error('Vui lòng nhập đầy đủ email và mật khẩu!');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    const toastId = notify.loading('Đang đăng nhập...');

    try {
      // Gọi BE Spring Boot - BE proxy đến Supabase GoTrue, trả tokens + user
      const tokens = await loginApi({ email, password });

      // Lưu access_token + refresh_token + user vào Zustand store (persist localStorage)
      // → axios interceptor sẽ tự đính kèm token vào mọi request sau đó.
      loginWithTokens(tokens);

      notify.dismiss(toastId);
      notify.success('Đăng nhập thành công!');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      notify.dismiss(toastId);
      // Lỗi đã được axios interceptor format - lấy message tiếng Việt từ BE
      const message = isApiError(err) ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium">
        <ArrowLeft className="w-5 h-5" /> Về trang chủ
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30 w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="text-center mb-10 relative z-10">
          <div className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-4 shadow-lg shadow-primary/20">
            B
          </div>
          <h1 className="text-3xl font-extrabold mb-2">Đăng Nhập</h1>
          <p className="text-on-surface-variant text-sm">Chào mừng bạn quay lại Bee Academy!</p>
        </div>

        <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email của bạn"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-sm font-semibold text-on-surface">Mật khẩu</label>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">Quên mật khẩu?</Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 flex items-center gap-3 relative z-10">
          <hr className="flex-1 border-outline-variant/40" />
          <span className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wide">hoặc</span>
          <hr className="flex-1 border-outline-variant/40" />
        </div>

        {/* Google button */}
        <motion.button
          type="button"
          onClick={handleGoogleLogin}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="mt-4 w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border border-outline-variant/50 bg-surface-container hover:bg-surface-container-high transition-all font-semibold text-on-surface shadow-sm relative z-10"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.8 6C12.2 13.1 17.6 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-3.9 6.9-9.7 7.2-16.7z"/>
            <path fill="#FBBC05" d="M10.3 28.7A14.4 14.4 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.8-6z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.4 0-11.8-4.3-13.7-10l-7.8 6C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Tiếp tục với Google
        </motion.button>

        <div className="mt-8 text-center text-sm text-on-surface-variant relative z-10">
          Chưa có tài khoản? <Link to="/register" className="text-primary font-bold hover:underline">Đăng ký ngay</Link>
        </div>
      </motion.div>
    </div>
  );
}
