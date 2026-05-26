// ═══════════════════════════════════════════════════════════════════════════════
// TRANG TÀI KHOẢN — AccountPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /account
//   Người dùng đến từ: Avatar dropdown header (click "Tài khoản")
//
// NỘI DUNG TRANG:
//   Form thông tin xác thực gồm 2 phần:
//     Phần 1 — Email: hiển thị email hiện tại, disabled (không cho sửa)
//     Phần 2 — Đổi mật khẩu: mật khẩu hiện tại + mật khẩu mới + xác nhận
//
// VALIDATION KHI LƯU:
//   - Mật khẩu hiện tại không được trống
//   - Mật khẩu mới không được trống
//   - Mật khẩu mới và xác nhận phải giống nhau
//   → Nếu tất cả hợp lệ: toast success + reset 3 field về ''
//
// LƯU Ý:
//   Email lấy trực tiếp từ useAuthStore — không cần state riêng vì chỉ display.
//   Khi kết nối backend thực, handleSave sẽ gọi API PATCH /users/me/password.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, Mail, Lock } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { changePassword as changePasswordApi } from '../../api/authService';
import { isApiError } from '../../api/client';

export default function AccountPage() {
  // ── Đọc email từ store — chỉ để hiển thị, không cho sửa ─────────────────────
  // Email là thông tin định danh tài khoản, chỉ admin mới được đổi (scope backend)
  const email = useAuthStore(state => state.user?.email ?? '');

  // ── State form đổi mật khẩu ──────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  // ── Xử lý lưu mật khẩu qua backend API ───────────────────────────────────────
  async function handleSave() {
    // Bước 1: kiểm tra mật khẩu hiện tại không trống
    if (!currentPassword.trim()) {
      notify.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    // Bước 2: kiểm tra mật khẩu mới không trống
    if (!newPassword.trim()) {
      notify.error('Vui lòng nhập mật khẩu mới');
      return;
    }

    // Bước 3: kiểm tra xác nhận khớp với mật khẩu mới
    if (newPassword !== confirmPassword) {
      notify.error('Mật khẩu xác nhận không khớp');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    const toastId = notify.loading('Đang cập nhật mật khẩu...');

    try {
      await changePasswordApi(currentPassword, newPassword);
      notify.dismiss(toastId);
      notify.success('Đã cập nhật mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notify.dismiss(toastId);
      const message = isApiError(err) ? err.message : 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner title="Tài khoản" subtitle="Quản lý thông tin xác thực của bạn" />

      {/* Nội dung full-width — sidebar nằm trong header (click avatar) */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main className="max-w-2xl">

          {/* ── Card form ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
          >

            {/* ── Header card: tiêu đề + subtitle ────────────────────────── */}
            <div className="px-6 pt-6 pb-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-extrabold text-on-surface">Thông tin tài khoản</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Chỉnh sửa cài đặt tài khoản của bạn.
              </p>
            </div>

            {/* ── Body card: các trường form ──────────────────────────────── */}
            <div className="px-6 py-6 space-y-4">

              {/* ── Field Email — disabled, chỉ hiển thị ──────────────────
                  bg-surface-container-high tạo màu xám nhạt phân biệt với
                  các field có thể chỉnh sửa bên dưới.
                  cursor-not-allowed là visual cue cho user biết không gõ được.
              ─────────────────────────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  {/* Icon Mail làm visual cue trái */}
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-sm text-on-surface-variant cursor-not-allowed select-none outline-none"
                  />
                </div>
              </div>

              {/* ── Đường kẻ phân cách ──────────────────────────────────── */}
              <hr className="border-outline-variant/30" />

              {/* ── Nhóm trường đổi mật khẩu ──────────────────────────────
                  3 field password xếp dọc, cùng kiểu style với ProfilePage.
                  Icon Lock bên trái làm visual cue thống nhất.
              ─────────────────────────────────────────────────────────── */}

              {/* Mật khẩu hiện tại */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

              {/* Xác nhận mật khẩu — phải khớp với newPassword khi submit */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 pointer-events-none" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Gõ lại mật khẩu của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

            </div>

             {/* ── Footer card: nút Lưu thay đổi ──────────────────────────── */}
            <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end">
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600 active:bg-teal-700 transition-colors shadow-sm shadow-teal-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </button>
            </div>

          </motion.div>
        </main>
      </div>
    </div>
  );
}
