/**
 * CourseReviewPage — Trang xem chi tiết & duyệt khóa học (UC36)
 *
 * Route: /admin/approvals/:courseId
 *
 * API:
 *  - GET /api/courses/{courseId}              — chi tiết khóa học (public endpoint)
 *  - GET /api/admin/courses/{courseId}/approval-history — lịch sử duyệt
 *  - POST /api/admin/courses/{courseId}/approve  — duyệt
 *  - POST /api/admin/courses/{courseId}/reject   — từ chối
 *  - POST /api/admin/courses/{courseId}/revise   — yêu cầu sửa
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { apiClient, unwrap, isApiError } from '../../api/client';
import type { ApiResponse } from '../../types/api';
import type { CourseDetail } from '../../types/api';
import type { ApprovalHistoryResponse } from '../../api/teacherCourseService';
import {
  LayoutDashboard, BookOpen, Users, FileText,
  Bell, LogOut, Menu, X, ChevronLeft,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronRight, Calculator, Megaphone, Settings,
  User, DollarSign, Layers, BookMarked,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',          path: '/admin'              },
  { icon: Users,           label: 'Tài khoản',          path: '/admin/users'        },
  { icon: BookOpen,        label: 'Duyệt khóa học',     path: '/admin/approvals'    },
  { icon: Calculator,      label: 'Kế toán & Lương',    path: '/admin/accounting'   },
  { icon: FileText,        label: 'Hộp thư khiếu nại',  path: '/admin/complaints'   },
  { icon: Megaphone,       label: 'Phát thông báo',     path: '/admin/notifications'},
  { icon: Settings,        label: 'Cài đặt hệ thống',   path: '/admin/settings'     },
];

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Badge cho action trong approval history
function ActionBadge({ action }: { action: ApprovalHistoryResponse['action'] }) {
  const config = {
    approved: { label: 'Đã duyệt', className: 'bg-green-500/10 text-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: 'Từ chối', className: 'bg-red-500/10 text-red-600', icon: <XCircle className="w-3 h-3" /> },
    needs_revision: { label: 'Yêu cầu sửa', className: 'bg-orange-500/10 text-orange-600', icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const { label, className, icon } = config[action];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${className}`}>
      {icon}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function CourseReviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  // useLocation() thay vì window.location — React Router cập nhật khi navigate (pushState)
  // window.location không trigger re-render nên active nav sẽ không đổi khi chuyển trang
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryResponse[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Accordion chapters — Set of expanded chapter IDs
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Action panel
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | 'revise' | null>(null);

  // ── Load dữ liệu ────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;

    // Load chi tiết khóa học (public endpoint)
    apiClient.get<ApiResponse<CourseDetail>>(`/api/courses/${courseId}`)
      .then(res => setCourse(unwrap(res.data)))
      .catch(() => notify.error('Không tải được thông tin khóa học'))
      .finally(() => setLoadingCourse(false));

    // Load lịch sử duyệt
    apiClient.get<ApiResponse<ApprovalHistoryResponse[]>>(
      `/api/admin/courses/${courseId}/approval-history`
    )
      .then(res => setHistory(unwrap(res.data)))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [courseId]);

  // ── Action handlers ────────────────────────────────────────────
  async function doAction(type: 'approve' | 'reject' | 'revise') {
    if (!courseId) return;

    if ((type === 'reject' || type === 'revise') && !comment.trim()) {
      notify.error(
        type === 'reject'
          ? 'Vui lòng nhập lý do từ chối trước khi gửi.'
          : 'Vui lòng nhập hướng dẫn chỉnh sửa trước khi gửi.',
      );
      return;
    }

    const endpoint = `/api/admin/courses/${courseId}/${type}`;
    const labels = { approve: 'Duyệt', reject: 'Từ chối', revise: 'Yêu cầu sửa' };
    const successMessages = {
      approve: 'Đã duyệt khóa học thành công',
      reject: 'Đã từ chối khóa học',
      revise: 'Đã gửi yêu cầu chỉnh sửa cho giáo viên',
    };

    setActionLoading(type);
    try {
      await apiClient.post(endpoint, { comment: comment.trim() || null });
      notify.success(successMessages[type]);
      navigate('/admin/approvals');
    } catch (err: unknown) {
      // apiClient interceptor đã bóc message từ body vào err.message (ApiError extends Error).
      // KHÔNG dùng err?.response?.data?.message — interceptor đã transform, .response không còn tồn tại.
      const msg = isApiError(err) ? err.message : `Không thực hiện được thao tác "${labels[type]}"`;
      notify.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
      return next;
    });
  }

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
            const isActive = location.pathname.startsWith(item.path) && item.path !== '/admin';
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb */}
            <nav className="hidden lg:flex items-center gap-2 text-sm">
              <Link to="/admin/approvals" className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                Duyệt khóa học
              </Link>
              <span className="text-on-surface-variant/40">/</span>
              <span className="font-semibold text-on-surface line-clamp-1 max-w-[200px]">
                {course?.title ?? 'Chi tiết khóa học'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
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

          {/* Back button (mobile) */}
          <button
            onClick={() => navigate('/admin/approvals')}
            className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-primary mb-5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Quay lại danh sách
          </button>

          {/* Loading skeleton */}
          {loadingCourse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <svg className="animate-spin w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-on-surface-variant font-medium">Đang tải thông tin khóa học...</p>
            </motion.div>
          )}

          {!loadingCourse && course && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* CỘT TRÁI: chi tiết khóa học + chapters */}
              <div className="xl:col-span-2 space-y-5">

                {/* Card thông tin cơ bản */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* Thumbnail banner */}
                  {course.thumbnailUrl && (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-40 object-cover"
                    />
                  )}

                  <div className="p-5">
                    <h2 className="text-xl font-extrabold text-on-surface mb-3">{course.title}</h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span>{course.teacherName ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <BookMarked className="w-4 h-4 flex-shrink-0" />
                        <span>{course.categoryName ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span className="font-bold text-on-surface">{formatVnd(course.priceVnd)}</span>
                        {course.salePriceVnd != null && (
                          <span className="text-xs text-red-500 ml-1">(KM: {formatVnd(course.salePriceVnd)})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                        <Layers className="w-4 h-4 flex-shrink-0" />
                        <span>{course.totalChapters} chương / {course.totalLessons} bài</span>
                      </div>
                      {course.grades.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <BookOpen className="w-4 h-4 flex-shrink-0" />
                          <span>Lớp {course.grades.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {course.description && (
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Mô tả</p>
                        <p className="text-sm text-on-surface leading-relaxed line-clamp-4">{course.description}</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Chapters accordion */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                    <h3 className="font-bold text-on-surface">Nội dung chương trình</h3>
                    <span className="text-sm text-on-surface-variant">
                      {course.chapters.length} chương · {course.totalLessons} bài
                    </span>
                  </div>

                  {course.chapters.length === 0 ? (
                    <p className="px-5 py-8 text-center text-on-surface-variant text-sm">Chưa có chương nào</p>
                  ) : (
                    <div className="divide-y divide-outline-variant/10">
                      {course.chapters.map((chapter, idx) => {
                        const isExpanded = expandedChapters.has(chapter.id);
                        return (
                          <div key={chapter.id}>
                            <button
                              onClick={() => toggleChapter(chapter.id)}
                              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-container/30 transition-colors text-left"
                            >
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="flex-1 font-semibold text-on-surface text-sm">{chapter.title}</span>
                              <span className="text-xs text-on-surface-variant mr-2">
                                {chapter.lessons.length} bài
                              </span>
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                              }
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <ul className="px-5 pb-3 space-y-1 bg-surface-container/20">
                                    {chapter.lessons.map((lesson, lIdx) => (
                                      <li key={lesson.id} className="flex items-center gap-2.5 py-2">
                                        <span className="w-5 h-5 rounded-full bg-surface-container border border-outline-variant text-xs font-bold text-on-surface-variant flex items-center justify-center flex-shrink-0">
                                          {lIdx + 1}
                                        </span>
                                        <span className="text-sm text-on-surface">{lesson.title}</span>
                                        {lesson.isFree && (
                                          <span className="text-xs font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">Miễn phí</span>
                                        )}
                                        {lesson.durationSec > 0 && (
                                          <span className="ml-auto text-xs text-on-surface-variant">
                                            {Math.round(lesson.durationSec / 60)} phút
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* CỘT PHẢI: action panel + approval history */}
              <div className="space-y-5">

                {/* Panel hành động */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
                >
                  <h3 className="font-bold text-on-surface mb-4">Quyết định duyệt</h3>

                  {/* Textarea comment */}
                  <label className="block mb-4">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Nhận xét / Lý do
                      <span className="text-on-surface-variant/60 font-normal normal-case ml-2">(bắt buộc khi từ chối hoặc yêu cầu sửa)</span>
                    </span>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Ghi chú cho giáo viên..."
                      rows={4}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50 resize-none"
                    />
                  </label>

                  {/* 3 nút hành động */}
                  <div className="space-y-2">
                    {/* Duyệt */}
                    <button
                      onClick={() => doAction('approve')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {actionLoading === 'approve' ? (
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Duyệt khóa học
                    </button>

                    {/* Yêu cầu sửa */}
                    <button
                      onClick={() => doAction('revise')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {actionLoading === 'revise' ? (
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      Yêu cầu chỉnh sửa
                    </button>

                    {/* Từ chối */}
                    <button
                      onClick={() => doAction('reject')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {actionLoading === 'reject' ? (
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Từ chối
                    </button>
                  </div>
                </motion.div>

                {/* Approval history timeline */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="px-5 py-4 border-b border-outline-variant/20">
                    <h3 className="font-bold text-on-surface">Lịch sử duyệt</h3>
                  </div>

                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-on-surface-variant text-sm">
                      <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Đang tải...
                    </div>
                  ) : history.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <Clock className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
                      <p className="text-sm text-on-surface-variant">Chưa có lịch sử duyệt</p>
                    </div>
                  ) : (
                    <div className="px-5 py-4 space-y-4">
                      {history.map((entry, idx) => (
                        <div key={entry.id} className="relative pl-5">
                          {/* Timeline line */}
                          {idx < history.length - 1 && (
                            <div className="absolute left-1.5 top-6 bottom-0 w-px bg-outline-variant/30" />
                          )}
                          {/* Dot */}
                          <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <ActionBadge action={entry.action} />
                              <span className="text-xs text-on-surface-variant">{entry.adminName}</span>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              {formatDateTime(entry.createdAt)}
                            </p>
                            {entry.comment && (
                              <p className="text-sm text-on-surface mt-1.5 italic bg-surface-container/50 rounded-lg px-3 py-2">
                                "{entry.comment}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          )}

          {/* Not found */}
          {!loadingCourse && !course && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <BookOpen className="w-14 h-14 text-on-surface-variant/30" />
              <p className="text-on-surface-variant font-medium">Không tìm thấy khóa học</p>
              <button
                onClick={() => navigate('/admin/approvals')}
                className="flex items-center gap-2 text-primary font-bold hover:underline"
              >
                <ChevronLeft className="w-4 h-4" />
                Quay lại danh sách
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
