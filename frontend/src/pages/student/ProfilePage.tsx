// ═══════════════════════════════════════════════════════════════════════════════
// TRANG HỒ SƠ — ProfilePage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /profile
//   Người dùng đến từ: Avatar dropdown header (click "Hồ sơ")
//
// NỘI DUNG:
//   Form chỉnh sửa thông tin cá nhân:
//     - Hàng 1: Tên | Họ (2 cột)
//     - Tiểu sử: textarea + toolbar Bold/Italic
//     - Divider
//     - Link Twitter / Facebook / LinkedIn
//     - Nút "Lưu" (teal)
//
// TOOLBAR TIỂU SỬ:
//   Nút B/I wrap text đang được chọn bằng Markdown (**text** / *text*).
//   useRef(textarea) → đọc selectionStart/End → chèn ký tự quanh selection.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Twitter, Facebook, Linkedin, Bold, Italic, Save } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { getMyProfile, updateMyProfile } from '../../api/authService';
import { isApiError } from '../../api/client';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const isStudent = user?.role === 'student';

  // ── State form ────────────────────────────────────────────────────────────
  const [firstName, setFirstName]   = useState('');
  const [lastName,  setLastName]    = useState('');
  const [bio,       setBio]         = useState('');
  const [twitter,   setTwitter]     = useState('');
  const [facebook,  setFacebook]    = useState('');
  const [linkedin,  setLinkedin]    = useState('');

  const [loading,   setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ref đến <textarea> tiểu sử — dùng để đọc/đặt lại vị trí con trỏ sau khi format
  const bioRef = useRef<HTMLTextAreaElement>(null);



  // ── Tải thông tin hồ sơ từ backend ─────────────────────────────────────────
  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getMyProfile();
        
        // Cắt họ tên thành Họ (lastName) và Tên (firstName)
        const parts = (profile.fullName ?? '').trim().split(/\s+/);
        if (parts.length > 1) {
          setLastName(parts[0]);
          setFirstName(parts.slice(1).join(' '));
        } else {
          setLastName('');
          setFirstName(parts[0] || '');
        }
        
        setBio(profile.bio ?? '');
        setTwitter(profile.twitterUrl ?? '');
        setFacebook(profile.facebookUrl ?? '');
        setLinkedin(profile.linkedinUrl ?? '');

      } catch (err) {
        const msg = isApiError(err) ? err.message : 'Không thể tải thông tin hồ sơ.';
        notify.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // ── Toolbar: chèn markdown Bold / Italic quanh text đang chọn ─────────────
  function applyFormat(type: 'bold' | 'italic') {
    const el = bioRef.current;
    if (!el) return;

    const start   = el.selectionStart;
    const end     = el.selectionEnd;
    const wrapper = type === 'bold' ? '**' : '*';
    const selected = bio.slice(start, end);

    const inner = selected || (type === 'bold' ? 'văn bản đậm' : 'văn bản nghiêng');

    const newBio = bio.slice(0, start) + wrapper + inner + wrapper + bio.slice(end);
    setBio(newBio);

    const newStart = start + wrapper.length;
    const newEnd   = newStart + inner.length;
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    }, 0);
  }

  // ── Lưu hồ sơ lên backend ──────────────────────────────────────────────────
  async function handleSave() {
    const fullName = `${lastName.trim()} ${firstName.trim()}`.trim();
    if (!fullName) {
      notify.error('Họ tên không được để trống!');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    const toastId = notify.loading('Đang lưu hồ sơ...');

    try {
      await updateMyProfile({
        fullName,
        bio,
        twitterUrl: twitter.trim(),
        facebookUrl: facebook.trim(),
        linkedinUrl: linkedin.trim(),
      });
      
      updateUser({ name: fullName });
      notify.dismiss(toastId);
      notify.success('Hồ sơ đã được lưu thành công!');
    } catch (err) {
      notify.dismiss(toastId);
      const msg = isApiError(err) ? err.message : 'Lưu hồ sơ thất bại. Vui lòng thử lại.';
      notify.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Hồ sơ" subtitle="Quản lý thông tin cá nhân của bạn" />
        <div className="flex-grow flex items-center justify-center p-8 bg-surface">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner title="Hồ sơ" subtitle="Quản lý thông tin cá nhân của bạn" />

      {/* Nội dung full-width */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main className="max-w-2xl">



          {/* ── Card form ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
          >

            {/* ── Header form ─────────────────────────────────────────────── */}
            <div className="px-6 pt-6 pb-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-extrabold text-on-surface">Chỉnh sửa hồ sơ</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Thêm thông tin về bản thân để chia sẻ trên hồ sơ của bạn.
              </p>
            </div>

            {/* ── Nội dung form ───────────────────────────────────────────── */}
            <div className="px-6 py-6 space-y-5">

              {/* ── Hàng 1: Tên | Họ ──────────────────────────────────────
                  2 cột ngang nhau, gap-4 giữa chúng
              ─────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Tên
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Họ
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Nhập họ của bạn"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

              {/* ── Tiểu sử + Toolbar B/I ─────────────────────────────────
                  Container bao gồm toolbar (trên) và textarea (dưới).
                  Border bao ngoài cả 2 để tạo cảm giác 1 khối nhất quán.
              ─────────────────────────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Tiểu sử
                </label>

                {/* Khối textarea + toolbar, cùng border, cùng background */}
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container overflow-hidden focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 transition-all">

                  {/* Toolbar định dạng — nằm trên textarea */}
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-outline-variant/30 bg-surface-container-low">
                    {/* Nút Bold — wrap selection bằng **text** */}
                    <button
                      type="button"
                      onClick={() => applyFormat('bold')}
                      title="In đậm (Markdown **text**)"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>

                    {/* Nút Italic — wrap selection bằng *text* */}
                    <button
                      type="button"
                      onClick={() => applyFormat('italic')}
                      title="In nghiêng (Markdown *text*)"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Textarea tiểu sử */}
                  <textarea
                    ref={bioRef}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Viết vài dòng giới thiệu bản thân..."
                    rows={5}
                    className="w-full px-4 py-3 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* ── Đường kẻ phân cách ──────────────────────────────────── */}
              <hr className="border-outline-variant/30" />

              {/* ── Liên kết mạng xã hội ──────────────────────────────────
                  Mỗi input có icon mạng xã hội bên trái làm visual cue.
              ─────────────────────────────────────────────────────────── */}
              <div className="space-y-3">

                {/* Twitter */}
                <div className="relative">
                  <Twitter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 pointer-events-none" />
                  <input
                    type="url"
                    value={twitter}
                    onChange={e => setTwitter(e.target.value)}
                    placeholder="Thêm liên kết twitter của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>

                {/* Facebook */}
                <div className="relative">
                  <Facebook className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
                  <input
                    type="url"
                    value={facebook}
                    onChange={e => setFacebook(e.target.value)}
                    placeholder="Thêm liên kết facebook của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>

                {/* LinkedIn */}
                <div className="relative">
                  <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-700 pointer-events-none" />
                  <input
                    type="url"
                    value={linkedin}
                    onChange={e => setLinkedin(e.target.value)}
                    placeholder="Thêm liên kết linkedin của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

            </div>

            {/* ── Footer form: nút Lưu ────────────────────────────────────── */}
            <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end">
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600 active:bg-teal-700 transition-colors shadow-sm shadow-teal-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Lưu
              </button>
            </div>

          </motion.div>
        </main>
      </div>
    </div>
  );
}
