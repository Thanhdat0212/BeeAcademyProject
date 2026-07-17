/**
 * AdminReportsPage — Báo cáo & Thống kê cho Admin (UC37)
 *
 * Biểu đồ time-series + phân bố từ /api/admin/analytics + /api/admin/dashboard/overview.
 * Bộ lọc khoảng thời gian (6/12 tháng / tất cả) lọc client-side trên chuỗi tháng.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  getAdminOverview,
  getAdminRevenueTrend,
  getAdminEnrollmentTrend,
  getUserGrowth,
  getCoursesByCategory,
  getAdminUserStats,
} from '../../api/adminService';
import type {
  AdminTopCourse,
  RevenueTrendPoint,
  CountPoint,
  AdminUserStats,
} from '../../api/adminService';
import ChartCard from '../../components/charts/ChartCard';
import RevenueTrendChart from '../../components/charts/RevenueTrendChart';
import TrendLineChart from '../../components/charts/TrendLineChart';
import RankBarChart from '../../components/charts/RankBarChart';
import DistributionDonut from '../../components/charts/DistributionDonut';
import { BRAND, BRAND_ALT, formatVndFull } from '../../lib/chartTheme';
import {
  LayoutDashboard, BookOpen, Users, FileText,
  LogOut, Menu, X, Calculator, Megaphone, Settings,
  BarChart3, RefreshCcw, Wallet, TrendingUp, PiggyBank, Landmark,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',          path: '/admin'            },
  { icon: Users,           label: 'Tài khoản',          path: '/admin/users'      },
  { icon: BookOpen,        label: 'Duyệt khóa học',     path: '/admin/approvals'  },
  { icon: Calculator,      label: 'Kế toán & Lương',    path: '/admin/accounting' },
  { icon: BarChart3,       label: 'Báo cáo & Thống kê', path: '/admin/reports'    },
  { icon: FileText,        label: 'Hộp thư khiếu nại',  path: '/admin/complaints' },
  { icon: Megaphone,       label: 'Phát thông báo',     path: '/admin/notifications' },
  { icon: Settings,        label: 'Cài đặt hệ thống',   path: '/admin/settings'   },
];

type RangeKey = '6' | '12' | 'all';
const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '6', label: '6 tháng' },
  { key: '12', label: '12 tháng' },
  { key: 'all', label: 'Tất cả' },
];

function sliceRange<T>(rows: T[], range: RangeKey): T[] {
  if (range === 'all') return rows;
  return rows.slice(-Number(range));
}

interface StatTileProps {
  label: string;
  value: string;
  icon: typeof Wallet;
  tint: string;
}

function StatTile({ label, value, icon: Icon, tint }: StatTileProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">{label}</p>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <p className="text-2xl font-extrabold text-on-surface mt-3 tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminReportsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>('12');

  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState<CountPoint[]>([]);
  const [userGrowth, setUserGrowth] = useState<CountPoint[]>([]);
  const [coursesByCategory, setCoursesByCategory] = useState<CountPoint[]>([]);
  const [userStats, setUserStats] = useState<AdminUserStats | null>(null);
  const [topCourses, setTopCourses] = useState<AdminTopCourse[]>([]);
  const [totals, setTotals] = useState({ gmv: 0, platformFee: 0, pendingPayout: 0, fundsHeld: 0 });

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  async function loadAll() {
    setLoading(true);
    try {
      const [rev, enr, growth, cats, stats, overview] = await Promise.all([
        getAdminRevenueTrend(),
        getAdminEnrollmentTrend(),
        getUserGrowth(),
        getCoursesByCategory(),
        getAdminUserStats(),
        getAdminOverview(),
      ]);
      setRevenueTrend(rev);
      setEnrollmentTrend(enr);
      setUserGrowth(growth);
      setCoursesByCategory(cats);
      setUserStats(stats);
      setTopCourses(overview.topCourses);
      setTotals({
        gmv: overview.totalGmv,
        platformFee: overview.totalPlatformFee,
        pendingPayout: overview.totalPendingPayout,
        fundsHeld: overview.totalFundsHeld,
      });
    } catch {
      notify.error('Không tải được dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const revenueData = useMemo(() => sliceRange(revenueTrend, range), [revenueTrend, range]);
  const enrollmentData = useMemo(
    () => sliceRange(enrollmentTrend, range).map(p => ({ label: p.label, value: p.count })),
    [enrollmentTrend, range],
  );
  const growthData = useMemo(
    () => sliceRange(userGrowth, range).map(p => ({ label: p.label, value: p.count })),
    [userGrowth, range],
  );
  const categoryData = useMemo(
    () => coursesByCategory.map(p => ({ label: p.label, value: p.count })),
    [coursesByCategory],
  );
  const roleData = useMemo(
    () => userStats ? [
      { label: 'Học sinh', value: userStats.students },
      { label: 'Giáo viên', value: userStats.teachers },
      { label: 'Phụ huynh', value: userStats.parents },
    ] : [],
    [userStats],
  );
  const topCourseData = useMemo(
    () => topCourses.map(c => ({ label: c.title, value: c.enrollmentCount })),
    [topCourses],
  );

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Báo cáo & Thống kê</h1>
          <div className="flex items-center gap-2 ml-auto">
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
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {/* Heading + range filter */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-6 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Báo cáo & Thống kê</h2>
              <p className="text-on-surface-variant mt-1">Doanh thu, đăng ký và tăng trưởng người dùng theo thời gian</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-surface-container rounded-xl p-1 border border-outline-variant/40">
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setRange(opt.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      range === opt.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={loadAll}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors text-sm font-medium border border-outline-variant"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>
          </motion.div>

          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatTile label="Tổng GMV" value={formatVndFull(totals.gmv)} icon={TrendingUp} tint="bg-primary/10 text-primary" />
            <StatTile label="Phí nền tảng" value={formatVndFull(totals.platformFee)} icon={PiggyBank} tint="bg-blue-500/10 text-blue-600" />
            <StatTile label="Cần chuyển GV" value={formatVndFull(totals.pendingPayout)} icon={Wallet} tint="bg-amber-500/10 text-amber-600" />
            <StatTile label="Tổng đang giữ" value={formatVndFull(totals.fundsHeld)} icon={Landmark} tint="bg-green-500/10 text-green-600" />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard
              title="Doanh thu theo tháng"
              subtitle="GV nhận + phí nền tảng = GMV"
              loading={loading}
              isEmpty={revenueData.length === 0}
            >
              <RevenueTrendChart
                data={revenueData}
                series={[
                  { key: 'teacherAmount', name: 'GV nhận', color: BRAND },
                  { key: 'platformFee', name: 'Phí nền tảng', color: BRAND_ALT },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Lượt đăng ký theo tháng"
              subtitle="Số enrollment mới mỗi tháng"
              loading={loading}
              isEmpty={enrollmentData.length === 0}
            >
              <TrendLineChart data={enrollmentData} name="Lượt đăng ký" />
            </ChartCard>

            <ChartCard
              title="Người dùng mới theo tháng"
              subtitle="Tài khoản đăng ký mới"
              loading={loading}
              isEmpty={growthData.length === 0}
            >
              <TrendLineChart data={growthData} name="Người dùng mới" color={BRAND_ALT} />
            </ChartCard>

            <ChartCard
              title="Top khóa học bán chạy"
              subtitle="Theo số lượt đăng ký"
              loading={loading}
              isEmpty={topCourseData.length === 0}
            >
              <RankBarChart data={topCourseData} name="Lượt đăng ký" />
            </ChartCard>

            <ChartCard
              title="Khóa học theo danh mục"
              subtitle="Phân bố khóa đã xuất bản"
              loading={loading}
              isEmpty={categoryData.length === 0}
            >
              <DistributionDonut data={categoryData} />
            </ChartCard>

            <ChartCard
              title="Phân bố người dùng"
              subtitle="Theo vai trò tài khoản"
              loading={loading}
              isEmpty={roleData.every(r => r.value === 0)}
            >
              <DistributionDonut data={roleData} />
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}
