import TeacherNotificationBell from '../../components/TeacherNotificationBell';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Bell,
  BookOpen,
  Bold,
  Camera,
  ClipboardList,
  Database,
  Facebook,
  FileText,
  GraduationCap,
  HelpCircle,
  Italic,
  Landmark,
  LayoutDashboard,
  Linkedin,
  LogOut,
  Menu,
  Megaphone,
  PenSquare,
  Save,
  Trash2,
  Twitter,
  Upload,
  UserCircle,
  Lock,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { getMyProfile, updateMyProfile, uploadAvatar } from '../../api/authService';
import { isApiError } from '../../api/client';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: FileText, label: 'Bài giảng', path: '/teacher/content' },
  { icon: PenSquare, label: 'Quiz chương', path: '/teacher/quiz' },
  { icon: Database, label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap, label: 'Bài kiểm tra', path: '/teacher/exam' },
  { icon: ClipboardList, label: 'Chấm điểm', path: '/teacher/grades' },
  { icon: HelpCircle, label: 'Hỏi & Đáp', path: '/teacher/qa' },
  { icon: Megaphone, label: 'Khiếu nại', path: '/teacher/complaints' },
  { icon: BarChart2, label: 'Doanh thu', path: '/teacher/revenue' },
  { icon: Landmark, label: 'TK ngân hàng', path: '/teacher/bank' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/teacher/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/teacher/account' },
] as const;

export default function TeacherProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [twitter, setTwitter] = useState('');
  const [facebook, setFacebook] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getMyProfile();
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

  function clearAvatarSelection() {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setSelectedAvatar(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      notify.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      notify.error('Dung lượng ảnh tối đa là 2MB.');
      event.target.value = '';
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setSelectedAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleAvatarUpload() {
    if (!selectedAvatar || uploadingAvatar) return;

    setUploadingAvatar(true);
    const toastId = notify.loading('Đang cập nhật ảnh đại diện...');

    try {
      const profile = await uploadAvatar(selectedAvatar);
      updateUser({ avatar: profile.avatarUrl || undefined });
      notify.dismiss(toastId);
      notify.success('Ảnh đại diện đã được cập nhật!');
      clearAvatarSelection();
    } catch (err) {
      notify.dismiss(toastId);
      const msg = isApiError(err) ? err.message : 'Không thể cập nhật ảnh đại diện.';
      notify.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function applyFormat(type: 'bold' | 'italic') {
    const el = bioRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const wrapper = type === 'bold' ? '**' : '*';
    const selected = bio.slice(start, end);
    const inner = selected || (type === 'bold' ? 'văn bản đậm' : 'văn bản nghiêng');

    const newBio = bio.slice(0, start) + wrapper + inner + wrapper + bio.slice(end);
    setBio(newBio);

    const newStart = start + wrapper.length;
    const newEnd = newStart + inner.length;
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    }, 0);
  }

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

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex font-sans">
        {isSidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex`}>
          <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
            <Link to="/teacher" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">B</div>
              <div>
                <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
                <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
              </div>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 text-on-surface-variant">
            Đang tải...
          </div>
        </aside>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">B</div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Hồ sơ giáo viên</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold text-on-surface">Chỉnh sửa hồ sơ</h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              Cập nhật thông tin cá nhân của giáo viên.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-6 pt-6 pb-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-extrabold text-on-surface">Chỉnh sửa hồ sơ</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Thêm thông tin về bản thân để hiển thị trên hồ sơ giáo viên.
              </p>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Ảnh đại diện
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl border border-outline-variant/30 bg-surface-container/40 p-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        avatarPreview
                        ?? user?.avatar
                        ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=160`
                      }
                      alt="Ảnh đại diện giáo viên"
                      className="w-24 h-24 rounded-full object-cover border-4 border-surface-container-lowest shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute -right-1 bottom-0 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                      title="Chọn ảnh đại diện"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface">
                      {selectedAvatar ? 'Ảnh mới đã sẵn sàng' : 'Cập nhật ảnh hồ sơ'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      JPG, PNG hoặc WEBP. Dung lượng tối đa 2MB.
                    </p>
                    {selectedAvatar && (
                      <p className="text-xs text-primary font-semibold mt-2 truncate">
                        {selectedAvatar.name} ({(selectedAvatar.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-sm font-bold text-on-surface hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60"
                      >
                        <Camera className="w-4 h-4" />
                        Chọn ảnh
                      </button>

                      {selectedAvatar && (
                        <>
                          <button
                            type="button"
                            onClick={handleAvatarUpload}
                            disabled={uploadingAvatar}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Upload className="w-4 h-4" />
                            {uploadingAvatar ? 'Đang tải lên...' : 'Lưu ảnh'}
                          </button>
                          <button
                            type="button"
                            onClick={clearAvatarSelection}
                            disabled={uploadingAvatar}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            Hủy
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-outline-variant/30" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Tên</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Họ</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Nhập họ của bạn"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Tiểu sử</label>
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-outline-variant/30 bg-surface-container-low">
                    <button
                      type="button"
                      onClick={() => applyFormat('bold')}
                      title="In đậm"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('italic')}
                      title="In nghiêng"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

              <hr className="border-outline-variant/30" />

              <div className="space-y-3">
                <div className="relative">
                  <Twitter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 pointer-events-none" />
                  <input
                    type="url"
                    value={twitter}
                    onChange={e => setTwitter(e.target.value)}
                    placeholder="Thêm liên kết Twitter của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>

                <div className="relative">
                  <Facebook className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
                  <input
                    type="url"
                    value={facebook}
                    onChange={e => setFacebook(e.target.value)}
                    placeholder="Thêm liên kết Facebook của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>

                <div className="relative">
                  <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-700 pointer-events-none" />
                  <input
                    type="url"
                    value={linkedin}
                    onChange={e => setLinkedin(e.target.value)}
                    placeholder="Thêm liên kết LinkedIn của bạn"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end">
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
