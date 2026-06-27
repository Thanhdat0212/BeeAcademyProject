import TeacherNotificationBell from '../../components/TeacherNotificationBell';
/**
 * TeacherRevenuePage — Trang "Doanh thu" cho Giáo viên (UC26 chi tiết + UC33)
 *
 * Mô hình v6.5: Admin chuyển khoản thủ công cuối kỳ
 *   - Mỗi lượt HS mua → hệ thống ghi 1 dòng `revenue_splits` (chi tiết giao dịch)
 *   - Hết kỳ (tháng) → Admin xuất Excel danh sách GV cần chuyển (UC39)
 *   - Admin chuyển tay → xác nhận trên hệ thống (UC40) → các giao dịch thuộc kỳ đó được đánh dấu PAID
 *
 * Trang có 2 TAB:
 *   - Tab 1 "Chi tiết giao dịch": realtime list từ revenue_splits
 *     + filter Khóa học / Trạng thái / Kỳ thanh toán
 *   - Tab 2 "Kỳ thanh toán": list các kỳ + status + thông tin chuyển khoản (nếu paid)
 *
 * Cross-link giữa 2 tab:
 *   - Click "Xem giao dịch kỳ này" ở Tab 2 → chuyển sang Tab 1 với filter sẵn theo kỳ đó
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { getRevenueSplits, getPayoutPeriods } from '../../api/revenueService';
import type { RevenueSplitResponse, PayoutPeriodResponse } from '../../api/revenueService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, DollarSign, Clock, CheckCircle2,
  TrendingUp, Calendar, Receipt, ArrowRight, Megaphone, Database, UserCircle, Lock,
} from 'lucide-react';

type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID';
type RevenueSplit = RevenueSplitResponse;
type PayoutPeriod = PayoutPeriodResponse & { monthYearDisplay: string };

function formatMonthYear(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return `Tháng ${parseInt(month)} / ${year}`;
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — NAV_ITEMS (đồng bộ sidebar teacher)
// ═══════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: Database,        label: 'Ngân hàng câu hỏi',  path: '/teacher/questions',},
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile',  },
  { icon: Lock,            label: 'Tài khoản',           path: '/teacher/account',  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — HELPERS
// ═══════════════════════════════════════════════════════════════════
// Format số → định dạng tiền VND theo locale Việt Nam
// Dùng Intl.NumberFormat thay vì tự thêm "đ" để xử lý đúng dấu phẩy/chấm
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — SUB-COMPONENT: PayoutStatusBadge
// ═══════════════════════════════════════════════════════════════════
function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const config = {
    PENDING: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ cuối kỳ',
      className: 'bg-amber-500/10 text-amber-600',
    },
    PROCESSING: {
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      label: 'Đang chuyển',
      className: 'bg-blue-500/10 text-blue-600',
    },
    PAID: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã nhận',
      className: 'bg-green-500/10 text-green-600',
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
//  PHẦN 6 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherRevenuePage() {
  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [splits, setSplits]   = useState<RevenueSplit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRevenueSplits(), getPayoutPeriods()])
      .then(([splitsData, periodsData]) => {
        setSplits(splitsData);
        setPeriods(periodsData.map(p => ({
          ...p,
          monthYearDisplay: formatMonthYear(p.monthYear),
          status: p.status,
        })));
      })
      .finally(() => setLoading(false));
  }, []);

  // Tab đang chọn — mặc định mở Chi tiết giao dịch vì là realtime
  const [activeTab, setActiveTab] = useState<'transactions' | 'periods'>('transactions');

  // Bộ lọc cho Tab 1 (Chi tiết giao dịch)
  // 'all' = không lọc
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  // Lọc theo kỳ — cross-link từ Tab 2 set state này
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── DERIVED: thống kê tổng hợp cho 4 stat cards ─────────────────
  // Dùng useMemo vì re-compute không cần thiết khi sidebar mở/đóng
  const stats = useMemo(() => {
    // Tính từ periods.status để xác định kỳ đã chuyển hay chưa
    const paidPeriodIds = new Set(periods.filter(p => p.status === 'PAID').map(p => p.id));

    let totalReceived = 0;   // Đã nhận về (từ kỳ paid)
    let totalPending = 0;    // Đang chờ chuyển (từ kỳ pending/processing)
    let totalGross = 0;      // Tổng GMV — tham khảo

    // Đếm giao dịch trong tháng hiện tại (theo Date.now())
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let thisMonthCount = 0;

    splits.forEach(s => {
      totalGross += s.grossAmount;
      if (paidPeriodIds.has(s.payoutPeriodId)) {
        totalReceived += s.teacherAmount;
      } else {
        totalPending += s.teacherAmount;
      }

      const d = new Date(s.occurredAt);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        thisMonthCount++;
      }
    });

    return { totalReceived, totalPending, totalGross, thisMonthCount };
  }, [splits, periods]);

  // ── Options dropdown khóa học (từ splits) ───────────────────────
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    splits.forEach(s => map.set(s.courseId, s.courseTitle));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [splits]);

  // ── Danh sách giao dịch đã lọc ──────────────────────────────────
  // Sort theo occurredAt DESC để giao dịch mới nhất lên đầu
  const filteredSplits = useMemo(() => {
    const paidPeriodIds = new Set(periods.filter(p => p.status === 'PAID').map(p => p.id));

    return splits
      .filter(s => {
        if (courseFilter !== 'all' && s.courseId !== courseFilter) return false;
        if (periodFilter !== 'all' && s.payoutPeriodId !== periodFilter) return false;
        if (statusFilter === 'paid' && !paidPeriodIds.has(s.payoutPeriodId)) return false;
        if (statusFilter === 'pending' && paidPeriodIds.has(s.payoutPeriodId)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [splits, periods, courseFilter, periodFilter, statusFilter]);

  // ── Map periodId → label để hiển thị trong table ────────────────
  const periodLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    periods.forEach(p => map.set(p.id, p.monthYearDisplay));
    return map;
  }, [periods]);

  // ── Handler: cross-link từ Tab 2 (kỳ X) → Tab 1 (filter theo kỳ X)
  function viewTransactionsOfPeriod(periodId: string) {
    setPeriodFilter(periodId);
    setCourseFilter('all');
    setStatusFilter('all');
    setActiveTab('transactions');
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

      {/* Overlay sidebar mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
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
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
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

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Doanh thu</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <img
              src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Tiêu đề */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Doanh thu của bạn</h2>
            <p className="text-on-surface-variant text-sm">
              Theo dõi giao dịch realtime và lịch sử các kỳ nhận tiền từ Admin
            </p>
          </motion.div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && (
          <>
          {/* ── 4 STAT CARDS ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            {/* Card 1: Tổng đã nhận (lifetime) */}
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Đã nhận</p>
                <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-lg font-extrabold text-on-surface">{formatCurrency(stats.totalReceived)}</p>
              <p className="text-xs text-on-surface-variant mt-1">Tổng từ trước đến nay</p>
            </div>

            {/* Card 2: Đang chờ chuyển */}
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Đang chờ chuyển</p>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-lg font-extrabold text-on-surface">{formatCurrency(stats.totalPending)}</p>
              <p className="text-xs text-on-surface-variant mt-1">Admin chuyển cuối kỳ</p>
            </div>

            {/* Card 3: Tổng GMV */}
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Tổng GMV</p>
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-lg font-extrabold text-on-surface">{formatCurrency(stats.totalGross)}</p>
              <p className="text-xs text-on-surface-variant mt-1">HS đã trả tổng cộng</p>
            </div>

            {/* Card 4: Số GD tháng này */}
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">GD tháng này</p>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-lg font-extrabold text-on-surface">{stats.thisMonthCount} giao dịch</p>
              <p className="text-xs text-on-surface-variant mt-1">Trong tháng hiện tại</p>
            </div>
          </motion.div>

          {/* ── TAB SWITCHER ───────────────────────────────────── */}
          <div className="flex gap-1 bg-surface-container/50 rounded-xl p-1 mb-4 w-fit">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'transactions'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Chi tiết giao dịch
            </button>
            <button
              onClick={() => setActiveTab('periods')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'periods'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Kỳ thanh toán
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────
              TAB 1 — CHI TIẾT GIAO DỊCH (realtime từ revenue_splits)
          ─────────────────────────────────────────────────────── */}
          {activeTab === 'transactions' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Bộ lọc */}
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Khóa học */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Khóa học
                    </span>
                    <select
                      value={courseFilter}
                      onChange={e => setCourseFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                    >
                      <option value="all">Tất cả khóa</option>
                      {courseOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.title}</option>
                      ))}
                    </select>
                  </label>

                  {/* Kỳ thanh toán */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Kỳ thanh toán
                    </span>
                    <select
                      value={periodFilter}
                      onChange={e => setPeriodFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                    >
                      <option value="all">Tất cả kỳ</option>
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>{p.monthYearDisplay}</option>
                      ))}
                    </select>
                  </label>

                  {/* Trạng thái */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Trạng thái
                    </span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as 'all' | 'pending' | 'paid')}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                    >
                      <option value="all">Tất cả</option>
                      <option value="pending">Chờ chuyển</option>
                      <option value="paid">Đã nhận</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Bảng giao dịch */}
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                  <h3 className="font-extrabold text-on-surface">
                    Giao dịch <span className="text-on-surface-variant font-normal">({filteredSplits.length})</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container/30">
                        <th className="text-left px-5 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Thời gian</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Học sinh</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Khóa học</th>
                        <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">HS trả</th>
                        <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Nền tảng</th>
                        <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Bạn nhận</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Kỳ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSplits.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-on-surface-variant">
                            Không có giao dịch nào khớp bộ lọc
                          </td>
                        </tr>
                      ) : (
                        filteredSplits.map((s, idx) => {
                          // Xác định trạng thái: kỳ này đã paid hay chưa
                          const period = periods.find(p => p.id === s.payoutPeriodId);
                          const isPaid = period?.status === 'PAID';

                          return (
                            <tr
                              key={s.id}
                              className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                                idx % 2 !== 0 ? 'bg-surface-container/20' : ''
                              }`}
                            >
                              <td className="px-5 py-3 text-on-surface-variant text-xs">
                                {formatDateTime(s.occurredAt)}
                              </td>
                              <td className="px-4 py-3 font-semibold text-on-surface">{s.studentName}</td>
                              <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">
                                <span className="line-clamp-1 max-w-[200px] block">{s.courseTitle}</span>
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface hidden lg:table-cell">
                                {formatCurrency(s.grossAmount)}
                              </td>
                              <td className="px-4 py-3 text-right text-on-surface-variant text-xs hidden lg:table-cell">
                                −{formatCurrency(s.platformFee)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="font-bold text-green-600">{formatCurrency(s.teacherAmount)}</p>
                                <p className="text-xs text-on-surface-variant">{s.teacherPercent}%</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-on-surface">{periodLabelMap.get(s.payoutPeriodId) ?? '—'}</span>
                                  <PayoutStatusBadge status={isPaid ? 'PAID' : 'PENDING'} />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────
              TAB 2 — LỊCH SỬ KỲ THANH TOÁN
          ─────────────────────────────────────────────────────── */}
          {activeTab === 'periods' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="space-y-4">
                {periods.map(period => (
                  <div
                    key={period.id}
                    className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
                  >
                    {/* Header: tên kỳ + trạng thái */}
                    <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                      <div>
                        <h3 className="font-extrabold text-on-surface text-lg flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          {period.monthYearDisplay}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {period.transactionCount} giao dịch
                        </p>
                      </div>
                      <PayoutStatusBadge status={period.status} />
                    </div>

                    {/* Tổng hợp 3 cột số tiền */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-surface-container/40 rounded-lg p-3">
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">HS trả</p>
                        <p className="text-sm font-bold text-on-surface">{formatCurrency(period.totalGross)}</p>
                      </div>
                      <div className="bg-surface-container/40 rounded-lg p-3">
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Nền tảng giữ</p>
                        <p className="text-sm font-bold text-on-surface-variant">−{formatCurrency(period.totalPlatformFee)}</p>
                      </div>
                      <div className="bg-green-500/10 rounded-lg p-3">
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">Bạn nhận</p>
                        <p className="text-sm font-extrabold text-green-600">{formatCurrency(period.totalTeacherAmount)}</p>
                      </div>
                    </div>

                    {/* Chi tiết chuyển khoản — chỉ hiện khi paid */}
                    {period.status === 'PAID' && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-3">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                          Chi tiết chuyển khoản
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-on-surface-variant">Admin xác nhận</p>
                            <p className="font-semibold text-on-surface">{period.transferRef}</p>
                          </div>
                          <div>
                            <p className="text-xs text-on-surface-variant">Ngày chuyển khoản</p>
                            <p className="font-semibold text-on-surface">
                              {period.paidAt ? formatDate(period.paidAt) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-on-surface-variant">Mã giao dịch ngân hàng</p>
                            <p className="font-mono font-semibold text-on-surface">{period.transferRef}</p>
                          </div>
                          <div>
                            <p className="text-xs text-on-surface-variant">Nội dung chuyển khoản</p>
                            <p className="font-semibold text-on-surface text-xs">{period.transferContent}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cross-link: xem các giao dịch của kỳ này (chuyển sang Tab 1) */}
                    <button
                      onClick={() => viewTransactionsOfPeriod(period.id)}
                      className="text-sm text-primary font-bold hover:underline inline-flex items-center gap-1"
                    >
                      Xem chi tiết {period.transactionCount} giao dịch
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          </>
          )}
        </main>
      </div>
    </div>
  );
}
