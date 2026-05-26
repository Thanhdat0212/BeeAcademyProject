import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  TrendingUp, TrendingDown, DollarSign, Users,
  Star, ChevronRight, Bell, LogOut, Menu, X,
  CheckCircle2, Clock, XCircle, PlusCircle,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone,
} from 'lucide-react';
import { MOCK_COURSES } from '../../data/mockCourses';

interface Sale {
  id: string;
  student: string;
  course: string;
  amount: number;
  commission: number;
  date: string;
  status: 'success' | 'pending' | 'failed';
}

interface StatCardData {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
  iconColor: string;
}

const MY_COURSES = MOCK_COURSES.slice(0, 4);

const MOCK_SALES: Sale[] = [
  { id: 'S-001', student: 'Nguyễn Văn An', course: MY_COURSES[0]?.title ?? 'Toán Đại Số', amount: 499000, commission: 349300, date: '19/05/2026', status: 'success' },
  { id: 'S-002', student: 'Trần Thị Bích', course: MY_COURSES[1]?.title ?? 'Vật Lý', amount: 550000, commission: 385000, date: '19/05/2026', status: 'success' },
  { id: 'S-003', student: 'Lê Minh Cường', course: MY_COURSES[0]?.title ?? 'Toán Đại Số', amount: 499000, commission: 349300, date: '18/05/2026', status: 'pending' },
  { id: 'S-004', student: 'Phạm Thị Dung', course: MY_COURSES[2]?.title ?? 'Hóa Học', amount: 400000, commission: 280000, date: '17/05/2026', status: 'success' },
  { id: 'S-005', student: 'Hoàng Quốc Đạt', course: MY_COURSES[3]?.title ?? 'Ngữ Văn', amount: 350000, commission: 245000, date: '16/05/2026', status: 'failed' },
];

const totalCommission = MOCK_SALES
  .filter(s => s.status === 'success')
  .reduce((sum, s) => sum + s.commission, 0);

const totalStudents = MY_COURSES.reduce((sum, c) => sum + c.students, 0);

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher', },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses', },
  { icon: FileText, label: 'Bài giảng', path: '/teacher/content', },
  { icon: PenSquare, label: 'Quiz chương', path: '/teacher/quiz', },
  { icon: GraduationCap, label: 'Bài kiểm tra', path: '/teacher/exam', },
  { icon: ClipboardList, label: 'Chấm điểm', path: '/teacher/grades', },
  { icon: HelpCircle, label: 'Hỏi & Đáp', path: '/teacher/qa', },
  { icon: Megaphone, label: 'Khiếu nại', path: '/teacher/complaints', },
  { icon: BarChart2, label: 'Doanh thu', path: '/teacher/revenue', },
  { icon: Landmark, label: 'TK ngân hàng', path: '/teacher/bank', },
];

interface StatCardProps { data: StatCardData; delay: number }

function StatCard({ data, delay }: StatCardProps) {
  const isPositive = data.change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-semibold text-on-surface-variant">{data.title}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.color}`}>
          <span className={data.iconColor}>{data.icon}</span>
        </div>
      </div>
      <p className="text-2xl font-extrabold text-on-surface mb-2">{data.value}</p>
      <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span>{isPositive ? '+' : ''}{data.change}% so với tháng trước</span>
      </div>
    </motion.div>
  );
}

function SaleStatusBadge({ status }: { status: Sale['status'] }) {
  const config = {
    success: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Thành công', className: 'bg-green-500/10 text-green-600' },
    pending: { icon: <Clock className="w-3.5 h-3.5" />, label: 'Đang chờ', className: 'bg-amber-500/10 text-amber-600' },
    failed: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Thất bại', className: 'bg-red-500/10   text-red-600' },
  };
  const { icon, label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${className}`}>
      {icon}{label}
    </span>
  );
}

function MyCoursesList() {
  const maxStudents = Math.max(...MY_COURSES.map(c => c.students));
  return (
    <div className="space-y-5">
      {MY_COURSES.map((course, idx) => (
        <div key={course.id}>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-sm font-semibold text-on-surface line-clamp-1 flex-1 pr-4">{course.title}</p>
            <span className="text-sm font-bold text-on-surface-variant flex-shrink-0">
              {course.students.toLocaleString('vi-VN')} HV
            </span>
          </div>
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(course.students / maxStudents) * 100}%` }}
              transition={{ delay: 0.3 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-on-surface-variant">{course.rating}</span>
            <span className="text-xs text-on-surface-variant">·</span>
            <span className="text-xs text-primary font-medium">{course.subject} · {course.grade}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardTeacher() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const statCards: StatCardData[] = [
    {
      title: 'Doanh thu kỳ này',
      value: `${totalCommission.toLocaleString('vi-VN')}đ`,
      change: 14.3,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'bg-green-500/10',
      iconColor: 'text-green-500',
    },
    {
      title: 'Tổng học viên',
      value: totalStudents.toLocaleString('vi-VN'),
      change: 9.1,
      icon: <Users className="w-5 h-5" />,
      color: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      title: 'Khóa học đang bán',
      value: MY_COURSES.length.toString(),
      change: 0,
      icon: <BookOpen className="w-5 h-5" />,
      color: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Lượt bán tháng này',
      value: MOCK_SALES.length.toString(),
      change: 5.7,
      icon: <BarChart2 className="w-5 h-5" />,
      color: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${isActive
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

        {/* Bank account banner — UC45: bắt buộc trước khi Admin xuất Excel chuyển khoản */}
        <div className="mx-4 mb-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-xs font-bold text-amber-600 mb-1">Chưa nhập TK ngân hàng</p>
          <p className="text-xs text-amber-600/80">Bắt buộc để Admin chuyển tiền cuối kỳ</p>
          <Link to="/teacher/bank" className="mt-2 block text-xs font-bold text-amber-600 hover:underline">
            Nhập ngay →
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

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-extrabold text-on-surface">
              Xin chào, {user?.name ?? 'Giáo viên'}! 👋
            </h2>
            <p className="text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, idx) => (
              <StatCard key={card.title} data={card} delay={idx * 0.1} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

            {/* Bảng doanh số gần đây */}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                      <th className="text-left px-6 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Học sinh</th>
                      <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Khóa học</th>
                      <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Hoa hồng</th>
                      <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden sm:table-cell">Ngày</th>
                      <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SALES.map((sale, idx) => (
                      <tr
                        key={sale.id}
                        className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container/20' : ''
                          }`}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(sale.student)}&size=32&background=random&bold=true`}
                              alt={sale.student}
                              className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                            <div>
                              <p className="font-semibold text-on-surface">{sale.student}</p>
                              <p className="text-xs text-on-surface-variant font-mono">{sale.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-on-surface-variant hidden md:table-cell">
                          <span className="line-clamp-1 max-w-[180px] block">{sale.course}</span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-green-600">
                          +{sale.commission.toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-4 py-3.5 text-on-surface-variant hidden sm:table-cell">{sale.date}</td>
                        <td className="px-4 py-3.5">
                          <SaleStatusBadge status={sale.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Khóa học của tôi */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-extrabold text-on-surface">Khóa học của tôi</h3>
                <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded-full font-medium">
                  Theo học viên
                </span>
              </div>
              <MyCoursesList />
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="font-extrabold text-on-surface mb-4">Thao tác nhanh</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: <PlusCircle className="w-6 h-6" />, label: 'Tạo khóa học', desc: 'Thêm khóa học mới', path: '/teacher/courses', color: 'bg-primary/10 text-primary hover:bg-primary/20' },
                { icon: <FileText className="w-6 h-6" />, label: 'Cập nhật bài', desc: 'Sửa bài giảng & tài liệu', path: '/teacher/content', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' },
                { icon: <HelpCircle className="w-6 h-6" />, label: 'Hỏi & Đáp', desc: 'Trả lời học sinh', path: '/teacher/qa', color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
                { icon: <Landmark className="w-6 h-6" />, label: 'TK ngân hàng', desc: 'Để Admin chuyển tiền cuối kỳ', path: '/teacher/bank', color: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' },
              ].map(action => (
                <Link
                  key={action.path}
                  to={action.path}
                  className={`flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/30 transition-all hover:shadow-sm group ${action.color}`}
                >
                  <div className="flex-shrink-0">{action.icon}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{action.label}</p>
                    <p className="text-xs opacity-70 mt-0.5 truncate">{action.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
