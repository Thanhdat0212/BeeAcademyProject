/**
 * ApprovalsPage — Trang duyệt khóa học cho Admin (UC36)
 *
 * Load danh sách khóa học đang chờ duyệt: GET /api/admin/courses/pending
 * Mỗi row có nút "Xem & Duyệt" → navigate /admin/approvals/:courseId
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { apiClient, unwrap } from '../../api/client';
import { listAdminNotifications, markAdminNotificationRead } from '../../api/adminService';
import type { AdminNotification } from '../../api/adminService';
import type { ApiResponse, PageResponse } from '../../types/api';
import {
  LayoutDashboard, BookOpen, Users, FileText,
  Bell, LogOut, Menu, X, Clock, Search,
  ChevronRight, Calculator, Megaphone, Settings,
  RefreshCcw, BookMarked, Layers,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

interface PendingCourse {
  id: string;
  title: string;
  teacherName: string;
  categoryName: string | null;
  grades: number[];
  priceVnd: number;
  totalChapters: number;
  totalLessons: number;
  submittedVersionNo: number;
  submittedAt: string;
  thumbnailUrl: string | null;
}

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION (đồng bộ DashboardAdmin)
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',          path: '/admin'            },
  { icon: Users,           label: 'Tài khoản',          path: '/admin/users'      },
  { icon: BookOpen,        label: 'Duyệt khóa học',     path: '/admin/approvals'  },
  { icon: Calculator,      label: 'Kế toán & Lương',    path: '/admin/accounting' },
  { icon: FileText,        label: 'Hộp thư khiếu nại',  path: '/admin/complaints' },
  { icon: Megaphone,       label: 'Phát thông báo',     path: '/admin/notifications'},
  { icon: Settings,        label: 'Cài đặt hệ thống',   path: '/admin/settings'   },
];

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ApprovalsPage() {
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();
  // useLocation() thay vì window.location — React Router cập nhật khi navigate (pushState)
  // window.location không trigger re-render nên active nav sẽ không đổi khi chuyển trang
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Load danh sách chờ duyệt ────────────────────────────────────
  async function loadPending() {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<PageResponse<PendingCourse>>>(
        '/api/admin/courses/pending',
        { params: { page: 0, size: 100, sort: 'updatedAt,asc' } },
      );
      setCourses(unwrap(res.data).items);
    } catch {
      notify.error('Không tải được danh sách chờ duyệt');
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const data = await listAdminNotifications(false);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }

  async function openNotification(notification: AdminNotification) {
    if (notification.unread) {
      try {
        await markAdminNotificationRead(notification.id);
        setUnreadCount(count => Math.max(0, count - 1));
        setNotifications(items => items.map(item =>
          item.id === notification.id ? { ...item, unread: false, readAt: new Date().toISOString() } : item));
      } catch {}
    }
    setShowNotifications(false);
    if (notification.targetPath) navigate(notification.targetPath);
  }

  useEffect(() => {
    loadPending();
    loadNotifications();
  }, []);

  // Lọc theo search query
  const filtered = courses.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.teacherName.toLowerCase().includes(q);
  });

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-xl shadow-lg shadow-primary/20">B</div>
            <div>
              <p className="font-extrabold text-sm text-on-surface">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Bảng Quản Trị</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant hover:bg-surface-container rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left ${
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

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Duyệt khóa học</h1>

          <div className="flex items-center gap-4 ml-auto">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(v => !v)}
                className="relative text-on-surface-variant hover:text-primary transition-colors"
                title="Thông báo duyệt khóa học"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-8 z-50 w-80 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-2xl">
                  <div className="border-b border-outline-variant/20 px-4 py-3">
                    <p className="text-sm font-extrabold text-on-surface">Thông báo Admin</p>
                    <p className="text-xs text-on-surface-variant">{unreadCount} thông báo chưa đọc</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-on-surface-variant">Chưa có thông báo</p>
                    ) : notifications.map(notification => (
                      <button
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                        className="w-full border-b border-outline-variant/10 px-4 py-3 text-left hover:bg-surface-container"
                      >
                        <div className="flex items-start gap-2">
                          {notification.unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-on-surface">{notification.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">{notification.message}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Admin'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Quản trị viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Admin')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar"
                className="w-9 h-9 rounded-full border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-6 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Duyệt khóa học</h2>
              {!loading && (
                <p className="text-on-surface-variant mt-1">
                  <span className="font-bold text-on-surface">{courses.length}</span> khóa học đang chờ duyệt
                </p>
              )}
            </div>

            <button
              onClick={loadPending}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors text-sm font-medium border border-outline-variant"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative mb-5"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên khóa học hoặc giáo viên..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/60"
            />
          </motion.div>

          {/* Loading */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <svg className="animate-spin w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-on-surface-variant font-medium">Đang tải danh sách chờ duyệt...</p>
            </motion.div>
          )}

          {/* Bảng */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
            >
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <BookMarked className="w-14 h-14 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant font-medium text-lg">
                    {searchQuery ? 'Không tìm thấy kết quả' : 'Không có khóa học nào chờ duyệt'}
                  </p>
                  <p className="text-on-surface-variant/70 text-sm mt-1">
                    {searchQuery ? 'Thử từ khóa khác' : 'Tất cả khóa học đã được xử lý'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                        <th className="text-left px-5 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Khóa học</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden sm:table-cell">Giáo viên</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Danh mục</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Chương / Bài</th>
                        <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Giá</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày nộp</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Hành động</th>
                      </tr>
                    </thead>

                    <tbody>
                      <AnimatePresence>
                        {filtered.map((course, idx) => (
                          <motion.tr
                            key={course.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                              idx % 2 !== 0 ? 'bg-surface-container/15' : ''
                            }`}
                          >
                            {/* Khóa học */}
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {course.thumbnailUrl ? (
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-12 h-10 rounded-lg object-cover border border-outline-variant/30 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-10 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="w-5 h-5 text-on-surface-variant/40" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-on-surface line-clamp-2 max-w-[200px]">{course.title}</p>
                                  {course.grades.length > 0 && (
                                    <p className="text-xs text-on-surface-variant">Lớp {course.grades.join(', ')}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Giáo viên */}
                            <td className="px-4 py-3 text-on-surface hidden sm:table-cell">
                              {course.teacherName}
                            </td>

                            {/* Danh mục */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                                {course.categoryName ?? '—'}
                              </span>
                            </td>

                            {/* Chương / Bài */}
                            <td className="px-4 py-3 text-center text-on-surface-variant hidden lg:table-cell">
                              <div className="flex items-center justify-center gap-1">
                                <Layers className="w-3.5 h-3.5" />
                                <span>{course.totalChapters}c / {course.totalLessons}b</span>
                              </div>
                            </td>

                            {/* Giá */}
                            <td className="px-4 py-3 text-right font-bold text-on-surface hidden md:table-cell whitespace-nowrap">
                              {formatVnd(course.priceVnd)}
                            </td>

                            {/* Ngày nộp */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
                                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                {formatDate(course.submittedAt)}
                              </div>
                            </td>

                            {/* Nút xem & duyệt */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => navigate(`/admin/approvals/${course.id}`)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 whitespace-nowrap"
                              >
                                Xem & Duyệt
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
