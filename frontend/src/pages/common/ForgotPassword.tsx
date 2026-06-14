import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, CheckCircle, RefreshCw } from 'lucide-react';
import { notify } from '../../lib/toast';
import { requestPasswordResetOtp, verifyPasswordResetOtp } from '../../api/authService';
import { isApiError } from '../../api/client';

type Step = 1 | 2 | 3;

export default function ForgotPassword() {
  const [step, setStep]                     = useState<Step>(1);
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp]                       = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting]         = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  // ── Step 1 validation ────────────────────────────────────────────────────
  const validateEmailForm = (): string | null => {
    if (!email.trim()) return 'Vui lòng nhập email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email không hợp lệ';
    return null;
  };

  // ── Step 2 validation ────────────────────────────────────────────────────
  const validateResetForm = (): string | null => {
    const code = otp.join('');
    if (code.length < 6) return 'Vui lòng nhập đủ 6 chữ số OTP';
    if (!password) return 'Vui lòng nhập mật khẩu mới';
    if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu mới';
    if (password !== confirmPassword) return 'Mật khẩu xác nhận không trùng khớp';
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
      return 'Mật khẩu mới tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số';
    return null;
  };

  // ── Gửi OTP (step 1 submit) ───────────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const err = validateEmailForm();
    if (err) { notify.error(err); return; }

    setSubmitting(true);
    const toastId = notify.loading('Đang kiểm tra và gửi mã OTP...');
    try {
      await requestPasswordResetOtp({ email: email.trim() });
      notify.dismiss(toastId);
      notify.success('Mã OTP phục hồi mật khẩu đã được gửi!');
      setStep(2);
      startResendCooldown();
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Yêu cầu thất bại. Email không tồn tại hoặc lỗi mạng.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Xác minh OTP & Đặt mật khẩu mới (step 2 submit) ───────────────────────
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const err = validateResetForm();
    if (err) { notify.error(err); return; }

    setSubmitting(true);
    const toastId = notify.loading('Đang xác minh OTP và đổi mật khẩu...');
    try {
      await verifyPasswordResetOtp({
        email: email.trim(),
        otp: otp.join(''),
        newPassword: password,
      });
      notify.dismiss(toastId);
      setStep(3);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Đặt lại mật khẩu thất bại. Mã OTP không đúng.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Gửi lại OTP ──────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || submitting) return;
    setSubmitting(true);
    const toastId = notify.loading('Đang gửi lại mã...');
    try {
      await requestPasswordResetOtp({ email: email.trim() });
      notify.dismiss(toastId);
      notify.success('Đã gửi lại mã OTP mới!');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      startResendCooldown();
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Gửi lại thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── OTP input helpers ─────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => setResendCooldown(s => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {step === 1 && (
        <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Quay lại Đăng nhập
        </Link>
      )}
      {step === 2 && (
        <button onClick={() => setStep(1)} className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Thay đổi Email
        </button>
      )}

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ─── Step 1: Nhập Email ───────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="text-center mb-8 relative z-10">
                <div className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-4 shadow-lg shadow-primary/20">B</div>
                <h1 className="text-3xl font-extrabold mb-2 text-on-surface">Quên Mật Khẩu</h1>
                <p className="text-on-surface-variant text-sm">Nhập email của bạn để nhận mã OTP khôi phục mật khẩu</p>
              </div>

              <form className="space-y-5 relative z-10" onSubmit={handleRequestOtp}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Email liên kết</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Nhập email của bạn"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all mt-4 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? 'Đang gửi mã...' : 'Gửi mã OTP xác thực →'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ─── Step 2: Nhập OTP & Đặt mật khẩu mới ────────────────────── */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-extrabold mb-2">Đặt Lại Mật Khẩu</h1>
                <p className="text-on-surface-variant text-sm">
                  Nhập mã OTP đã được gửi đến:<br />
                  <strong className="text-on-surface">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOtpAndReset} className="space-y-5">
                {/* 6 ô OTP */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1 block text-center">Mã OTP 6 số</label>
                  <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-surface-container
                          ${digit ? 'border-primary text-primary' : 'border-outline-variant/50 text-on-surface'}
                          focus:border-primary focus:ring-2 focus:ring-primary/20`}
                      />
                    ))}
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự (chữ hoa và số)"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Xác nhận mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Xác nhận lại mật khẩu mới"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                <button type="submit" disabled={submitting || otp.join('').length < 6}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? 'Đang thực hiện...' : 'Xác nhận đặt lại mật khẩu'}
                </button>
              </form>

              {/* Cooldown đếm ngược gửi lại OTP */}
              <div className="mt-6 text-center">
                <p className="text-xs text-on-surface-variant mb-2">Không nhận được mã OTP?</p>
                <button onClick={handleResend} disabled={resendCooldown > 0 || submitting}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 3: Đổi mật khẩu thành công ────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30 text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10" />
              </motion.div>
              <h2 className="text-2xl font-extrabold mb-2 text-on-surface">Đổi Mật Khẩu Thành Công!</h2>
              <p className="text-on-surface-variant">
                Mật khẩu của tài khoản <strong className="text-on-surface">{email}</strong><br />
                đã được thiết lập lại thành công.
              </p>
              <p className="text-sm text-on-surface-variant mt-6 opacity-70">
                Đang tự động chuyển hướng về trang đăng nhập...
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
