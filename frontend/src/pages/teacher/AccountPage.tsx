import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Bell,
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  PenSquare,
  Save,
  UserCircle,
  Lock,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { changePassword as changePasswordApi } from '../../api/authService';
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

export default function TeacherAccountPage() {
  const email = useAuthStore(state => state.user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  async function handleSave() {
    if (!currentPassword.trim()) {
      notify.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }

    if (!newPassword.trim()) {
      notify.error('Vui lòng nhập mật khẩu mới');
      return;
    }

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

  function handleLogout() {
    logout();
    navigate('/login');
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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Đổi mật khẩu</h1>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
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
            <h2 className="text-2xl font-extrabold text-on-surface">Đổi mật khẩu</h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              Cập nhật thông tin đăng nhập cho tài khoản giáo viên.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-6 pt-6 pb-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-extrabold text-on-surface">Thông tin tài khoản</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Chỉnh sửa cài đặt bảo mật của giáo viên.
              </p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-sm text-on-surface-variant cursor-not-allowed select-none outline-none"
                  />
                </div>
              </div>

              <hr className="border-outline-variant/30" />

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Gõ lại mật khẩu mới"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end">
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
