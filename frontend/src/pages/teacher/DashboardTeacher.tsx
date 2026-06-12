import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { getTeacherStats } from '../../api/revenueService';
import { listMyCourses } from '../../api/teacherCourseService';
import type { TeacherStatsResponse, RevenueSplitResponse } from '../../api/revenueService';
import type { TeacherCourseResponse } from '../../api/teacherCourseService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  TrendingUp, TrendingDown, DollarSign, Users,
  ChevronRight, Bell, LogOut, Menu, X,
  CheckCircle2, PlusCircle,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone, Database, Loader2, PackageOpen,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * Tính % thay đổi so với tháng trước.
 * Nếu tháng trước = 0 và tháng này > 0 → +100% (mới có doanh thu).
 * Nếu cả hai = 0 → 0% (không thay đổi).
 */
function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function courseStatusMeta(status: TeacherCourseResponse['status']) {
  switch (status) {
    case 'published':
      return { label: 'Đang bán', className: 'bg-green-500/10 text-green-600' };
    case 'pending_review':
      return { label: 'Chờ duyệt', className: 'bg-amber-500/10 text-amber-600' };
    case 'draft':
      return { label: 'Bản nháp', className: 'bg-surface-container text-on-surface-variant' };
    case 'approved':
      return { label: 'Đã duyệt', className: 'bg-blue-500/10 text-blue-600' };
    case 'rejected':
      return { label: 'Bị từ chối', className: 'bg-red-500/10 text-red-600' };
    case 'needs_revision':
      return { label: 'Cần sửa', className: 'bg-orange-500/10 text-orange-600' };
    default:
      return { label: status, className: 'bg-surface-container text-on-surface-variant' };
  }
}

// ─── Nav ────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',        path: '/teacher'           },
  { icon: BookOpen,        label: 'Khóa học của tôi', path: '/teacher/courses'   },
  { icon: FileText,        label: 'Bài giảng',         path: '/teacher/content'   },
  { icon: PenSquare,       label: 'Quiz chương',       path: '/teacher/quiz'      },
  { icon: Database,        label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap,   label: 'Bài kiểm tra',      path: '/teacher/exam'      },
  { icon: ClipboardList,   label: 'Chấm điểm',         path: '/teacher/grades'    },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',         path: '/teacher/qa'        },
  { icon: Megaphone,       label: 'Khiếu nại',         path: '/teacher/complaints'},
  { icon: BarChart2,       label: 'Doanh thu',         path: '/teacher/revenue'   },
  { icon: Landmark,        label: 'TK ngân hàng',      path: '/teacher/bank'      },
];

// ─── StatCard ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
  iconColor: string;
  delay: number;
}

function StatCard({ title, value, change, icon, color, iconColor, delay }: StatCardProps) {
  const pos = change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-semibold text-on-surface-variant">{title}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <p className="text-2xl font-extrabold text-on-surface mb-2">{value}</p>
      <div className={`flex items-center gap-1 text-sm font-semibold ${pos ? 'text-green-500' : 'text-red-500'}`}>
        {pos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span>{pos ? '+' : ''}{change}% so với tháng trước</span>
      </div>
    </motion.div>
  );
}

// ─── MyCoursesList ───────────────────────────────────────────────────────────

interface CourseStat {
  course: TeacherCourseResponse;
  salesCount: number;
}

function MyCoursesList({ items }: { items: CourseStat[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
        <PackageOpen className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Chưa có khóa học nào</p>
        <Link to="/teacher/courses" className="text-xs text-primary font-bold mt-2 hover:underline">
          Tạo khóa học mới →
        </Link>
      </div>
    );
  }

  const max = Math.max(...items.map(i => i.salesCount), 1);
  return (
    <div className="space-y-5">
      {items.map(({ course, salesCount }, idx) => (
        <div key={course.id}>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-sm font-semibold text-on-surface line-clamp-1 flex-1 pr-4">
              {course.title}
            </p>
            <span className="text-sm font-bold text-on-surface-variant flex-shrink-0">
              {salesCount} đơn
            </span>
          </div>
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(salesCount / max) * 100}%` }}
              transition={{ delay: 0.3 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${courseStatusMeta(course.status).className}`}>
              {courseStatusMeta(course.status).label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardTeacher() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // stats: số liệu tổng hợp từ server (1 call thay vì 3)
  const [stats, setStats] = useState<TeacherStatsResponse | null>(null);
  // courses: vẫn cần để render bar chart với đầy đủ thông tin title/status
  const [courses, setCourses] = useState<TeacherCourseResponse[]>([]);

  const didLoadRef = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    // Chỉ load 1 lần dù StrictMode render 2 lần
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    setLoading(true);
    Promise.allSettled([
      getTeacherStats(),
      listMyCourses(0, 50).then(p => p.items),
    ])
      .then(([statsResult, coursesResult]) => {
        const failed: string[] = [];

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        } else {
          failed.push('doanh thu');
        }

        if (coursesResult.status === 'fulfilled') {
          setCourses(coursesResult.value);
        } else {
          failed.push('khóa học');
        }

        if (failed.length > 0) {
          notify.error(`Không thể tải ${failed.join(', ')}`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Stat card values (lấy trực tiếp từ server, không tính client-side) ─────

  // % thay đổi so với tháng trước — tính từ giá trị server trả về
  const revChange     = pctChange(stats?.currentMonthRevenue ?? 0,  stats?.previousMonthRevenue ?? 0);
  const salesChange   = pctChange(stats?.currentMonthSalesCount ?? 0, stats?.previousMonthSalesCount ?? 0);

  // ── 8 giao dịch gần đây (server đã slice sẵn) ─────────────────────────────
  const recentSplits: RevenueSplitResponse[] = stats?.recentSplits ?? [];

  // ── Bar chart: ghép TeacherCourseResponse (title/status) với enrollment count ─
  // courseEnrollmentCounts từ server: { [courseId]: count }
  const courseStats = useMemo<CourseStat[]>(() => {
    const counts = stats?.courseEnrollmentCounts ?? {};
    return courses.slice(0, 5).map(c => ({
      course: c,
      // Dùng enrollment count từ server thay vì đếm splits client-side
      salesCount: counts[c.id] ?? 0,
    }));
  }, [courses, stats]);

  function handleLogout() { logout(); navigate('/login'); }

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
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

        {/* UC45 banner: nhắc nhập TK ngân hàng */}
        <div className="mx-4 mb-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-xs font-bold text-amber-600 mb-1">Nhập TK ngân hàng</p>
          <p className="text-xs text-amber-600/80">Bắt buộc để Admin chuyển tiền cuối kỳ</p>
          <Link to="/teacher/bank" className="mt-2 block text-xs font-bold text-amber-600 hover:underline">
            Thiết lập ngay →
          </Link>
        </div>

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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Tổng quan</h1>
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
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="avatar"
                className="w-9 h-9 rounded-full border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Greeting */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="text-2xl font-extrabold text-on-surface">
              Xin chào, {user?.name ?? 'Giáo viên'}!
            </h2>
            <p className="text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Stat cards — giá trị lấy từ stats server, không tính lại client-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <StatCard
                  delay={0}
                  title="Doanh thu tháng này"
                  value={fmt(stats?.currentMonthRevenue ?? 0)}
                  change={revChange}
                  icon={<DollarSign className="w-5 h-5" />}
                  color="bg-green-500/10"
                  iconColor="text-green-500"
                />
                <StatCard
                  delay={0.1}
                  title="Học viên đã mua"
                  value={(stats?.uniqueStudentsTotal ?? 0).toLocaleString('vi-VN')}
                  change={0}
                  icon={<Users className="w-5 h-5" />}
                  color="bg-blue-500/10"
                  iconColor="text-blue-500"
                />
                <StatCard
                  delay={0.2}
                  title="Khóa học đang bán"
                  value={(stats?.publishedCoursesCount ?? 0).toString()}
                  change={0}
                  icon={<BookOpen className="w-5 h-5" />}
                  color="bg-primary/10"
                  iconColor="text-primary"
                />
                <StatCard
                  delay={0.3}
                  title="Lượt bán tháng này"
                  value={(stats?.currentMonthSalesCount ?? 0).toString()}
                  change={salesChange}
                  icon={<BarChart2 className="w-5 h-5" />}
                  color="bg-amber-500/10"
                  iconColor="text-amber-500"
                />
              </div>

              {/* Recent sales + Course list */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

                {/* Recent sales */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                    <h3 className="font-extrabold text-on-surface">Doanh số gần đây</h3>
                    <Link to="/teacher/revenue" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
                      Xem tất cả <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {recentSplits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-on-surface-variant">
                      <DollarSign className="w-10 h-10 opacity-20 mb-3" />
                      <p className="text-sm">Chưa có giao dịch nào</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                            <th className="text-left px-6 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Học sinh</th>
                            <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Khóa học</th>
                            <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Hoa hồng</th>
                            <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden sm:table-cell">Ngày</th>
                            <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">TT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentSplits.map((split, idx) => (
                            <tr
                              key={split.id}
                              className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                                idx % 2 !== 0 ? 'bg-surface-container/20' : ''
                              }`}
                            >
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(split.studentName)}&size=32&background=random&bold=true`}
                                    alt={split.studentName}
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                  />
                                  <p className="font-semibold text-on-surface">{split.studentName}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant hidden md:table-cell">
                                <span className="line-clamp-1 max-w-[180px] block">{split.courseTitle}</span>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-green-600">
                                +{fmt(split.teacherAmount)}
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant hidden sm:table-cell">
                                {fmtDate(split.occurredAt)}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />Thành công
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>

                {/* Courses panel */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-extrabold text-on-surface">Khóa học của tôi</h3>
                    <Link to="/teacher/courses" className="text-xs text-primary font-bold hover:underline">
                      Quản lý
                    </Link>
                  </div>
                  <MyCoursesList items={courseStats} />
                </motion.div>
              </div>

              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <h3 className="font-extrabold text-on-surface mb-4">Thao tác nhanh</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: <PlusCircle className="w-6 h-6" />, label: 'Tạo khóa học',   desc: 'Thêm khóa học mới',            path: '/teacher/courses', color: 'bg-primary/10 text-primary hover:bg-primary/20' },
                    { icon: <FileText    className="w-6 h-6" />, label: 'Cập nhật bài',   desc: 'Sửa bài giảng & tài liệu',     path: '/teacher/content', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' },
                    { icon: <HelpCircle  className="w-6 h-6" />, label: 'Hỏi & Đáp',      desc: 'Trả lời học sinh',              path: '/teacher/qa',      color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
                    { icon: <Landmark    className="w-6 h-6" />, label: 'TK ngân hàng',   desc: 'Để Admin chuyển tiền cuối kỳ', path: '/teacher/bank',    color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' },
                  ].map(a => (
                    <Link
                      key={a.path}
                      to={a.path}
                      className={`flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/30 transition-all hover:shadow-sm group ${a.color}`}
                    >
                      <div className="flex-shrink-0">{a.icon}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{a.label}</p>
                        <p className="text-xs opacity-70 mt-0.5 truncate">{a.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
