/**
 * TeacherCoursesPage — Trang "Khóa học của tôi" cho Giáo viên (UC27)
 *
 * Luồng chính:
 *  1. GV vào trang → thấy danh sách các khóa học mình đã tạo
 *  2. Mỗi khóa hiển thị: ảnh bìa, tên, danh mục, giá, ngày tạo, trạng thái duyệt
 *  3. GV có thể: Tạo mới / Chỉnh sửa / Xóa (chỉ với khóa chưa duyệt)
 *
 * Workflow trạng thái duyệt (theo UC36 — Admin duyệt khóa học):
 *  draft  ──submit──▶  pending  ──Admin Approve──▶  approved (xuất bản)
 *                       │
 *                       └──Admin Reject──▶  needs_revision (GV sửa rồi submit lại)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Pencil, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertTriangle, Megaphone,
} from 'lucide-react';
import { MOCK_COURSES } from '../../data/mockCourses';
import type { Course } from '../../data/mockCourses';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES & MOCK DATA
// ═══════════════════════════════════════════════════════════════════

// 4 trạng thái duyệt khóa học theo UseCase v6.5:
//   - draft:          Bản nháp, GV chưa submit cho Admin
//   - pending:        Đã submit, chờ Admin duyệt
//   - approved:       Admin đã Approve → khóa học đã xuất bản, HS mua được
//   - needs_revision: Admin yêu cầu chỉnh sửa → GV sửa rồi submit lại
type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'needs_revision';

// Mở rộng Course gốc + thêm 2 field quản lý duyệt
interface TeacherCourse extends Course {
  approvalStatus: ApprovalStatus;
  createdAt: string; // ISO date — vd "2026-05-18"
}

// Mock data: lấy 4 course đầu từ MOCK_COURSES, gán 4 trạng thái khác nhau
// để demo đủ các case của ApprovalBadge và logic ẩn nút Xóa
const TEACHER_COURSES: TeacherCourse[] = [
  { ...MOCK_COURSES[0], approvalStatus: 'approved',       createdAt: '2026-03-12' },
  { ...MOCK_COURSES[1], approvalStatus: 'pending',        createdAt: '2026-05-10' },
  { ...MOCK_COURSES[2], approvalStatus: 'needs_revision', createdAt: '2026-04-28' },
  { ...MOCK_COURSES[3], approvalStatus: 'draft',          createdAt: '2026-05-18' },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — NAVIGATION ITEMS (đồng bộ với DashboardTeacher)
// ═══════════════════════════════════════════════════════════════════
// Duy trì cùng danh sách menu với DashboardTeacher để sidebar nhất quán
// Nếu sau này nhiều trang teacher hơn → cân nhắc tách thành <TeacherSidebar />
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * ApprovalBadge — Pill hiển thị trạng thái duyệt với icon + màu sắc semantic
 * Tách thành component riêng để: dễ tái sử dụng, dễ đổi style đồng loạt
 */
function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  // Mapping: status → { icon, label tiếng Việt, class màu }
  // Màu sắc theo convention:
  //   approved       → xanh lá  (success)
  //   pending        → vàng     (waiting)
  //   needs_revision → đỏ       (cần GV action)
  //   draft          → xám      (chưa submit, neutral)
  const config = {
    approved: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã duyệt',
      className: 'bg-green-500/10 text-green-600',
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ duyệt',
      className: 'bg-amber-500/10 text-amber-600',
    },
    needs_revision: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'Cần chỉnh sửa',
      className: 'bg-red-500/10 text-red-600',
    },
    draft: {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Bản nháp',
      className: 'bg-on-surface-variant/10 text-on-surface-variant',
    },
  };
  const { icon, label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>
      {icon}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Format ISO date (YYYY-MM-DD) → DD/MM/YYYY theo locale vi-VN
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Format giá bán hiển thị.
// Hiện mockCourses.price là string đã format sẵn (vd "499.000đ") → trả về luôn.
// Khi backend trả về Int VND → dùng Intl.NumberFormat (xem rules/tech-stack.md)
function formatPrice(price?: string): string {
  return price ?? 'Chưa định giá';
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherCoursesPage() {
  // ── State ───────────────────────────────────────────────────────
  // courses: danh sách hiển thị (thay đổi khi xóa).
  // Dùng useState thay vì hardcode TEACHER_COURSES để hỗ trợ delete tương tác.
  // Khi tích hợp backend, thay state này bằng React Query.
  const [courses, setCourses] = useState<TeacherCourse[]>(TEACHER_COURSES);

  // Sidebar mobile toggle (giống pattern trong DashboardTeacher)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Handler: Tạo khóa học mới (UC27) ──────────────────────────
  // Hiện chưa có trang /teacher/courses/new → tạm hiển thị toast.
  // Sau này: navigate('/teacher/courses/new')
  function handleCreate() {
    notify.info('Trang tạo khóa học đang được phát triển');
  }

  // ── Handler: Chỉnh sửa khóa học ───────────────────────────────
  // CHO PHÉP edit ở MỌI trạng thái (kể cả approved). Lý do:
  //   - approved: GV vẫn có thể update nội dung — backend sẽ chuyển về pending
  //     để Admin duyệt lại bản mới (logic v6.5).
  //   - draft/pending/needs_revision: edit bình thường.
  function handleEdit(courseId: string) {
    notify.info(`Mở trang chỉnh sửa khóa học ${courseId} (chưa xây)`);
    // navigate(`/teacher/courses/${courseId}/edit`);
  }

  // ── Handler: Xóa khóa học ─────────────────────────────────────
  // RÀNG BUỘC NGHIỆP VỤ QUAN TRỌNG:
  //   Chỉ cho xóa nếu approvalStatus !== 'approved'.
  //   Khóa đã duyệt đang được học sinh truy cập (có Enrollment),
  //   xóa sẽ làm mất dữ liệu của HS → phải qua Admin (UC38 khiếu nại).
  function handleDelete(course: TeacherCourse) {
    // Defensive check: kể cả nút Xóa đã ẩn ở UI, vẫn check ở handler
    // để tránh bypass (vd: gọi từ keyboard shortcut sau này).
    if (course.approvalStatus === 'approved') {
      notify.error('Không thể xóa khóa học đã duyệt — vui lòng liên hệ Admin');
      return;
    }

    // Confirm bằng window.confirm cho đơn giản (MVP).
    // Sau này thay bằng <ConfirmDialog /> theo Material 3.
    const ok = window.confirm(`Bạn chắc chắn muốn xóa "${course.title}"?`);
    if (!ok) return;

    // Filter ra course bị xóa. Dùng functional update để tránh stale closure
    // nếu sau này gọi từ async callback.
    setCourses(prev => prev.filter(c => c.id !== course.id));
    notify.success(`Đã xóa khóa học "${course.title}"`);
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

      {/* ── Overlay che màn hình khi sidebar mở trên mobile ──────── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      {/* Mobile: drawer trượt từ trái. Desktop: cố định bên trái */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Logo + nút đóng (mobile) */}
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">
              B
            </div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu chính */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            // Active state: exact match với pathname hiện tại
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

        {/* Banner nhắc nhập TK ngân hàng (UC45) */}
        <div className="mx-4 mb-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-xs font-bold text-amber-600 mb-1">Chưa nhập TK ngân hàng</p>
          <p className="text-xs text-amber-600/80">Bắt buộc để Admin chuyển tiền cuối kỳ</p>
          <Link to="/teacher/bank" className="mt-2 block text-xs font-bold text-amber-600 hover:underline">
            Nhập ngay →
          </Link>
        </div>

        {/* Đăng xuất */}
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

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header (giống DashboardTeacher) */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Khóa học của tôi</h1>

          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">2</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên Bee'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Teacher avatar"
                className="w-9 h-9 rounded-full border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* ── PAGE HEADING + NÚT TẠO MỚI ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-6 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Khóa học của tôi</h2>
              <p className="text-on-surface-variant mt-1">
                Tổng số: <span className="font-bold text-on-surface">{courses.length}</span> khóa học
              </p>
            </div>

            {/* Nút Tạo mới — primary action, đặt nổi bật bên phải */}
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              Tạo khóa học mới
            </button>
          </motion.div>

          {/* ── BẢNG DANH SÁCH KHÓA HỌC ────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {/* Header bảng */}
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                    <th className="text-left px-6 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Ảnh bìa</th>
                    <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Tên khóa học</th>
                    <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Danh mục</th>
                    <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden sm:table-cell">Giá bán</th>
                    <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày tạo</th>
                    <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                    <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Hành động</th>
                  </tr>
                </thead>

                {/* Body — render từng row */}
                {/* AnimatePresence để có exit animation khi xóa course */}
                <tbody>
                  <AnimatePresence>
                    {courses.map((course, idx) => {
                      // Tính trước canDelete để tránh check 2 lần (ẩn nút + handler)
                      // Chỉ xóa được khi khóa CHƯA được Admin duyệt
                      const canDelete = course.approvalStatus !== 'approved';

                      return (
                        <motion.tr
                          key={course.id}
                          // Animation: fade vào khi mount, trượt sang trái khi xóa
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                          transition={{ delay: idx * 0.05 }}
                          // Zebra striping cho dễ đọc hàng
                          className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                            idx % 2 !== 0 ? 'bg-surface-container/20' : ''
                          }`}
                        >
                          {/* Cột 1: Ảnh bìa */}
                          <td className="px-6 py-3">
                            <img
                              src={course.image}
                              alt={course.title}
                              className="w-16 h-12 rounded-lg object-cover border border-outline-variant/30 flex-shrink-0"
                            />
                          </td>

                          {/* Cột 2: Tên khóa học (limit 2 dòng) */}
                          <td className="px-4 py-3 max-w-[280px]">
                            <p className="font-semibold text-on-surface line-clamp-2">
                              {course.title}
                            </p>
                            {/* Hiển thị grade nhỏ phía dưới tên */}
                            <p className="text-xs text-on-surface-variant mt-0.5">{course.grade}</p>
                          </td>

                          {/* Cột 3: Danh mục (subject) — pill nhỏ */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                              {course.subject}
                            </span>
                          </td>

                          {/* Cột 4: Giá bán — căn phải, in đậm */}
                          <td className="px-4 py-3 font-bold text-on-surface text-right hidden sm:table-cell">
                            {formatPrice(course.price)}
                          </td>

                          {/* Cột 5: Ngày tạo (DD/MM/YYYY) */}
                          <td className="px-4 py-3 text-on-surface-variant hidden lg:table-cell">
                            {formatDate(course.createdAt)}
                          </td>

                          {/* Cột 6: Trạng thái duyệt */}
                          <td className="px-4 py-3">
                            <ApprovalBadge status={course.approvalStatus} />
                          </td>

                          {/* Cột 7: Hành động (Edit + Delete) */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit: luôn hiển thị */}
                              <button
                                onClick={() => handleEdit(course.id)}
                                title="Chỉnh sửa"
                                className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Delete: chỉ render khi canDelete = true.
                                  Render khoảng trống có cùng kích thước để cột giữ alignment */}
                              {canDelete ? (
                                <button
                                  onClick={() => handleDelete(course)}
                                  title="Xóa"
                                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <div className="w-8 h-8" aria-hidden="true" />
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Empty state — khi đã xóa hết khóa học */}
            {courses.length === 0 && (
              <div className="py-16 text-center">
                <BookOpen className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                <p className="text-on-surface-variant">Bạn chưa có khóa học nào</p>
                <button
                  onClick={handleCreate}
                  className="mt-4 text-primary font-bold hover:underline"
                >
                  Tạo khóa học đầu tiên →
                </button>
              </div>
            )}
          </motion.div>

          {/* ── GHI CHÚ WORKFLOW ──────────────────────────────── */}
          {/* Giải thích cho GV biết quy trình duyệt và giới hạn xóa */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
          >
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <span className="font-bold text-blue-600">Lưu ý:</span> Khóa học sau khi tạo cần được Admin duyệt trước khi xuất bản.
              Bạn <span className="font-bold text-on-surface">không thể xóa khóa học đã duyệt</span> —
              nếu cần gỡ, vui lòng liên hệ Admin qua mục Khiếu nại.
            </p>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
