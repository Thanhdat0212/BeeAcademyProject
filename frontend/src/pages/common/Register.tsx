import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, CheckCircle, RefreshCw } from 'lucide-react';
import { notify } from '../../lib/toast';
import { requestOtp, verifyOtp } from '../../api/authService';
import { isApiError } from '../../api/client';

type Role = 'student' | 'parent' | 'teacher';
type Step = 1 | 2 | 3;

export default function Register() {
  const [step, setStep]         = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState<Role>('student');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  // ── Step 1 validation ────────────────────────────────────────────────────
  const validateForm = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) return 'Họ tên tối thiểu 2 ký tự';
    if (!email.trim()) return 'Vui lòng nhập email';
    if (!password) return 'Vui lòng nhập mật khẩu';
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
      return 'Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số';
    return null;
  };

  // ── Gửi OTP (step 1 submit) ───────────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const err = validateForm();
    if (err) { notify.error(err); return; }

    setSubmitting(true);
    const toastId = notify.loading('Đang gửi mã OTP...');
    try {
      await requestOtp({ fullName: fullName.trim(), email: email.trim(), role });
      notify.dismiss(toastId);
      notify.success('Mã OTP đã được gửi đến email của bạn!');
      setStep(2);
      startResendCooldown();
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Không thể gửi OTP. Thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Xác minh OTP (step 2 submit) ─────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const code = otp.join('');
    if (code.length < 6) { notify.error('Vui lòng nhập đủ 6 chữ số'); return; }

    setSubmitting(true);
    const toastId = notify.loading('Đang xác minh...');
    try {
      await verifyOtp({ email: email.trim(), otp: code, password });
      notify.dismiss(toastId);
      setStep(3);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Xác minh thất bại. Thử lại.');
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
      await requestOtp({ fullName: fullName.trim(), email: email.trim(), role });
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
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Về trang chủ
        </Link>
      )}
      {step === 2 && (
        <button onClick={() => setStep(1)} className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Quay lại
        </button>
      )}

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ─── Step 1: Form đăng ký ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30 overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />

              <div className="text-center mb-8 relative z-10">
                <div className="w-12 h-12 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-4 shadow-lg shadow-primary/20">B</div>
                <h1 className="text-3xl font-extrabold mb-2">Đăng Ký</h1>
                <p className="text-on-surface-variant text-sm">Tạo tài khoản để bắt đầu học tập!</p>
              </div>

              <form className="space-y-5 relative z-10" onSubmit={handleRequestOtp}>
                {/* Họ tên */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Nhập họ tên của bạn"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Nhập email của bạn"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                {/* Mật khẩu */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Mật khẩu</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none" />
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="≥8 ký tự, có chữ hoa và số"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50" />
                  </div>
                </div>

                {/* Vai trò */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface ml-1">Bạn là</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['student', 'parent', 'teacher'] as Role[]).map(r => (
                      <button type="button" key={r} onClick={() => setRole(r)}
                        className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          role === r ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-on-surface-variant border-outline-variant/50 hover:border-primary'
                        }`}>
                        {r === 'student' ? 'Học sinh' : r === 'parent' ? 'Phụ huynh' : 'Giáo viên'}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all mt-4 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? 'Đang gửi mã...' : 'Gửi mã xác thực →'}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-on-surface-variant relative z-10">
                Đã có tài khoản? <Link to="/login" className="text-primary font-bold hover:underline">Đăng nhập</Link>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Nhập OTP ─────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-surface-container-lowest p-8 md:p-12 rounded-[2rem] shadow-xl shadow-primary/5 border border-outline-variant/30"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-extrabold mb-2">Xác thực Email</h1>
                <p className="text-on-surface-variant text-sm">
                  Mã OTP đã được gửi đến<br />
                  <strong className="text-on-surface">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 6 ô OTP */}
                <div className="flex gap-3 justify-center" onPaste={handleOtpPaste}>
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
                      className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all bg-surface-container
                        ${digit ? 'border-primary text-primary' : 'border-outline-variant/50 text-on-surface'}
                        focus:border-primary focus:ring-2 focus:ring-primary/20`}
                    />
                  ))}
                </div>

                <button type="submit" disabled={submitting || otp.join('').length < 6}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? 'Đang xác minh...' : 'Xác nhận & Tạo tài khoản'}
                </button>
              </form>

              {/* Gửi lại */}
              <div className="mt-6 text-center">
                <p className="text-sm text-on-surface-variant mb-2">Không nhận được mã?</p>
                <button onClick={handleResend} disabled={resendCooldown > 0 || submitting}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline">
                  <RefreshCw className="w-4 h-4" />
                  {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 3: Thành công ───────────────────────────────────── */}
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
              <h2 className="text-2xl font-extrabold mb-2">Đăng Ký Thành Công!</h2>
              <p className="text-on-surface-variant">
                Tài khoản <strong className="text-on-surface">{email}</strong><br />
                đã được tạo thành công.
              </p>
              <p className="text-sm text-on-surface-variant mt-4 opacity-70">
                Đang chuyển hướng đến trang đăng nhập...
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
