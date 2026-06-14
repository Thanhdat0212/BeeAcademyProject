/**
 * HỆ ĐIỀU HÀNH QUẢN TRỊ ADMIN (ADMIN CONSOLE) — Bee Academy
 *
 * Tích hợp toàn diện 8 Use Case (UC34 - UC41) trong Module 8:
 *  - Overview Tab      — UC34 (Dashboard quản lý tài chính & vận hành)
 *  - Users Tab         — UC35 (Quản lý và cập nhật tài khoản người dùng)
 *  - Courses Tab       — UC36 (Phê duyệt khóa học mới của Giáo viên)
 *  - Payouts Tab       — UC37, UC39, UC40 (Xem doanh thu, Xuất báo cáo, Xác nhận chuyển khoản GV)
 *  - Complaints Tab    — UC38 (Xử lý khiếu nại từ học sinh/phụ huynh)
 *  - Announcements Tab — UC41 (Gửi thông báo hệ thống đa đối tượng)
 *  - Settings Tab      — Cấu hình phí nền tảng & chế độ bảo trì
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { apiClient, unwrap } from '../../api/client';
import { getAdminOverview } from '../../api/adminService';
import type { AdminOverview } from '../../api/adminService';
import { getAdminComplaintStats } from '../../api/complaintService';
import PayoutsPanel from '../../components/admin/PayoutsPanel';
import ComplaintsInbox from '../../components/admin/ComplaintsInbox';
import type { ApiResponse, PageResponse } from '../../types/api';
import {
  LayoutDashboard, BookOpen, Users, ShoppingBag,
  FileText, TrendingUp, TrendingDown, DollarSign,
  Star, ChevronRight, Bell, LogOut, Menu, X,
  CheckCircle2, Clock, XCircle, PlusCircle, Calculator, Wallet, BarChart2, Settings,
  AlertTriangle, Search, Filter, Download, Send, Check, Ban, MessageSquare, AlertCircle, Calendar, Hash, Megaphone, CheckCircle, ShieldAlert, Edit2, RotateCcw
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// KIỂU DỮ LIỆU (Types & Interfaces)
// ─────────────────────────────────────────────────────────────────────────────

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'parent';
  status: 'active' | 'blocked';
  createdAt: string;
}

interface CourseApproval {
  id: string;
  title: string;
  teacherName: string;
  subject: string;
  grade: string;
  price: number;
  submittedAt: string;
  status: 'pending' | 'approved' | 'revision_required' | 'rejected';
  reason?: string;
}

interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  target: 'all' | 'students' | 'teachers' | 'parents';
  priority: 'low' | 'normal' | 'high';
  sentAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES API THẬT
// ─────────────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  avatarUrl: string | null;
  isBlocked: boolean;
  createdAt: string;
}

interface UserStats { students: number; teachers: number; parents: number; total: number; }
interface PendingCourseSummary { id: string; title: string; teacherName: string; submittedAt: string; }

// ─────────────────────────────────────────────────────────────────────────────
// DỮ LIỆU KHỞI TẠO MOCK (Initial Mock Data — sẽ được thay dần bằng API)
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_USERS: UserAccount[] = [
  { id: 'USR-001', name: 'Nguyễn Văn An', email: 'an.nv@beeacademy.edu.vn', role: 'student', status: 'active', createdAt: '10/01/2026' },
  { id: 'USR-002', name: 'Thầy Trần Hữu Nam', email: 'nam.th@beeacademy.edu.vn', role: 'teacher', status: 'active', createdAt: '05/01/2026' },
  { id: 'USR-003', name: 'Chị Lê Thị Mai (PH)', email: 'mai.lt.parent@gmail.com', role: 'parent', status: 'active', createdAt: '12/02/2026' },
  { id: 'USR-004', name: 'Lê Minh Cường', email: 'cuong.lm@gmail.com', role: 'student', status: 'blocked', createdAt: '15/02/2026' },
  { id: 'USR-005', name: 'Cô Nguyễn Thị Hoa', email: 'hoa.nt@beeacademy.edu.vn', role: 'teacher', status: 'active', createdAt: '20/01/2026' },
  { id: 'USR-006', name: 'Trần Thị Bích', email: 'bich.tt@gmail.com', role: 'student', status: 'active', createdAt: '18/02/2026' },
];

const INITIAL_COURSES_APPROVAL: CourseApproval[] = [
  { id: 'CRS-APV-001', title: 'Toán Hình Học Lớp 8 Nâng Cao', teacherName: 'Thầy Trần Hữu Nam', subject: 'Toán', grade: 'Lớp 8', price: 499000, submittedAt: '19/05/2026', status: 'pending' },
  { id: 'CRS-APV-002', title: 'Ngữ Văn Lớp 9 - Trọng Tâm Ôn Thi Lớp 10', teacherName: 'Cô Nguyễn Thị Hoa', subject: 'Ngữ văn', grade: 'Lớp 9', price: 599000, submittedAt: '20/05/2026', status: 'pending' },
  { id: 'CRS-APV-003', title: 'Tiếng Anh Giao Tiếp Cơ Bản Lớp 7', teacherName: 'Cô Nguyễn Thị Hoa', subject: 'Tiếng Anh', grade: 'Lớp 7', price: 399000, submittedAt: '15/05/2026', status: 'approved' },
  { id: 'CRS-APV-004', title: 'KHTN Lớp 6 - Lý & Hóa Căn Bản', teacherName: 'Thầy Trần Hữu Nam', subject: 'KHTN', grade: 'Lớp 6', price: 299000, submittedAt: '12/05/2026', status: 'revision_required', reason: 'Thiếu file tài liệu bài tập chương 3 và âm thanh video bài 2 bị rè.' },
];

const INITIAL_ANNOUNCEMENTS: SystemAnnouncement[] = [
  { id: 'ANN-001', title: 'Bảo trì hệ thống định kỳ tháng 5', content: 'Hệ thống sẽ tiến hành bảo trì từ 2:00 sáng đến 4:00 sáng ngày 25/05/2026. Một số tính năng xem bài giảng và thanh toán sẽ tạm ngưng hoạt động trong thời gian này.', target: 'all', priority: 'high', sentAt: '20/05/2026 15:30' },
  { id: 'ANN-002', title: 'Cập nhật chính sách thưởng giáo viên xuất sắc', content: 'Kể từ ngày 01/06/2026, Bee Academy áp dụng mức thưởng thêm 5% doanh thu khóa học cho các khóa học đạt mức đánh giá trung bình từ 4.8 sao trở lên và có trên 100 học sinh mới đăng ký trong tháng.', target: 'teachers', priority: 'normal', sentAt: '18/05/2026 09:00' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardAdmin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore(state => state.logout);

  // Lấy tab hoạt động từ URL query (?tab=...), mặc định là 'overview'
  const activeTab = searchParams.get('tab') || 'overview';

  // State quản lý dữ liệu động của toàn trang
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [coursesApproval, setCoursesApproval] = useState<CourseApproval[]>(INITIAL_COURSES_APPROVAL);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(INITIAL_ANNOUNCEMENTS);

  // Số khiếu nại đang chờ xử lý — cho badge sidebar + chuông header (API thật)
  const [complaintPendingCount, setComplaintPendingCount] = useState(0);

  // State cấu hình hệ thống
  const [platformFeePercent, setPlatformFeePercent] = useState(20);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // STATE CHO CÁC BIỂU MẪU & MODALS
  // ───────────────────────────────────────────────────────────────────────────
  // Modal Phê duyệt Khóa học (Từ chối / Cần chỉnh sửa)
  const [courseActionModal, setCourseActionModal] = useState<{ isOpen: boolean; course: CourseApproval | null; action: 'reject' | 'revision' | null }>({
    isOpen: false, course: null, action: null
  });
  const [courseReason, setCourseReason] = useState('');

  // Biểu mẫu gửi thông báo mới
  const [announcementForm, setAnnouncementForm] = useState({
    title: '', content: '', target: 'all' as SystemAnnouncement['target'], priority: 'normal' as SystemAnnouncement['priority']
  });

  // Tìm kiếm và lọc
  const [searchUser, setSearchUser] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterUserRole, setFilterUserRole] = useState<string>('all');
  const [filterCourseStatus, setFilterCourseStatus] = useState<string>('all');

  // ── STATE & CALLBACKS API THẬT (phải đặt sau filter state) ───────
  const [apiUsers,       setApiUsers]       = useState<AdminUser[]>([]);
  const [loadingUsers,   setLoadingUsers]   = useState(false);
  const [userStats,      setUserStats]      = useState<UserStats | null>(null);
  const [pendingCourses, setPendingCourses] = useState<PendingCourseSummary[]>([]);
  const [pendingTotal,   setPendingTotal]   = useState(0);
  const [loadingPending, setLoadingPending] = useState(false);
  const [overview,       setOverview]       = useState<AdminOverview | null>(null);
  const [userPage,       setUserPage]       = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(0);

  const loadUsers = useCallback(async (page = 0) => {
    setLoadingUsers(true);
    try {
      const params: Record<string, string | number> = { page, size: 20 };
      if (filterUserRole !== 'all') params.role = filterUserRole;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await apiClient.get<ApiResponse<PageResponse<AdminUser>>>('/api/admin/users', { params });
      const data = unwrap(res.data);
      setApiUsers(data.items);
      setUserPage(data.page);
      setUserTotalPages(data.totalPages);
    } catch { notify.error('Không tải được danh sách tài khoản'); }
    finally { setLoadingUsers(false); }
  }, [filterUserRole, debouncedSearch]);

  const loadUserStats = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse<UserStats>>('/api/admin/users/stats');
      setUserStats(unwrap(res.data));
    } catch {}
  }, []);

  const loadPendingCourses = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await apiClient.get<ApiResponse<PageResponse<PendingCourseSummary>>>(
        '/api/admin/courses/pending', { params: { page: 0, size: 5, sort: 'updatedAt,asc' } });
      const data = unwrap(res.data);
      setPendingCourses(data.items);
      setPendingTotal(data.totalItems);
    } catch {}
    finally { setLoadingPending(false); }
  }, []);

  const loadOverview = useCallback(async () => {
    try { setOverview(await getAdminOverview()); } catch {}
  }, []);

  const loadComplaintBadge = useCallback(async () => {
    try { setComplaintPendingCount((await getAdminComplaintStats()).pending); } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadUserStats(), loadPendingCourses(), loadOverview(), loadComplaintBadge()]);
  }, [loadUserStats, loadPendingCourses, loadOverview, loadComplaintBadge]);
  useEffect(() => { if (activeTab === 'users') loadUsers(0); }, [activeTab, loadUsers]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchUser), 300);
    return () => clearTimeout(t);
  }, [searchUser]);

  // Đăng xuất
  function handleLogout() {
    logout();
    navigate('/login');
    notify.success('Đăng xuất thành công!');
  }

  // Chuyển Tab qua URL search param
  function changeTab(tabId: string) {
    setSearchParams({ tab: tabId });
    setIsSidebarOpen(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WORKFLOW 1: QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG (UC35)
  // ───────────────────────────────────────────────────────────────────────────
  async function handleToggleBlockUser(userId: string) {
    const target = apiUsers.find(u => u.id === userId);
    if (!target) return;
    const newBlocked = !target.isBlocked;
    try {
      await apiClient.patch(`/api/admin/users/${userId}/block?blocked=${newBlocked}`);
      setApiUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: newBlocked } : u));
      notify.success(`Đã ${newBlocked ? 'khóa' : 'mở khóa'} tài khoản ${target.fullName ?? target.email}`);
    } catch (err: unknown) {
      notify.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thực hiện được');
    }
  }

  async function handleChangeRole(userId: string, newRole: AdminUser['role']) {
    const target = apiUsers.find(u => u.id === userId);
    if (!target || target.role === newRole) return;
    try {
      await apiClient.patch(`/api/admin/users/${userId}/role?role=${newRole}`);
      setApiUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      const roleLabel: Record<AdminUser['role'], string> = { student: 'Học sinh', teacher: 'Giáo viên', parent: 'Phụ huynh', admin: 'Admin' };
      notify.success(`Đã đổi vai trò ${target.fullName ?? target.email} → ${roleLabel[newRole]}`);
    } catch (err: unknown) {
      notify.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không đổi được vai trò');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WORKFLOW 2: DUYỆT KHÓA HỌC (UC36)
  // ───────────────────────────────────────────────────────────────────────────
  const filteredCoursesApproval = useMemo(() => {
    return coursesApproval.filter(c => filterCourseStatus === 'all' || c.status === filterCourseStatus);
  }, [coursesApproval, filterCourseStatus]);

  function handleApproveCourse(courseId: string) {
    setCoursesApproval(prev => prev.map(c => {
      if (c.id === courseId) {
        notify.success(`Đã phê duyệt khóa học "${c.title}" lên trang học sinh!`);
        return { ...c, status: 'approved' as const };
      }
      return c;
    }));
  }

  function handleOpenCourseActionModal(course: CourseApproval, action: 'reject' | 'revision') {
    setCourseActionModal({ isOpen: true, course, action });
    setCourseReason('');
  }

  function handleSubmitCourseAction() {
    if (!courseReason.trim()) {
      notify.error('Vui lòng cung cấp nội dung phản hồi!');
      return;
    }
    const { course, action } = courseActionModal;
    if (!course) return;

    setCoursesApproval(prev => prev.map(c => {
      if (c.id === course.id) {
        if (action === 'reject') {
          notify.error(`Đã từ chối xuất bản khóa học "${c.title}"`);
          return { ...c, status: 'rejected' as const, reason: courseReason };
        } else {
          notify.info(`Đã yêu cầu giáo viên sửa đổi khóa học "${c.title}"`);
          return { ...c, status: 'revision_required' as const, reason: courseReason };
        }
      }
      return c;
    }));
    setCourseActionModal({ isOpen: false, course: null, action: null });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WORKFLOW 5: GỬI THÔNG BÁO HỆ THỐNG (UC41)
  // ───────────────────────────────────────────────────────────────────────────
  function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      notify.error('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo!');
      return;
    }

    const newAnn: SystemAnnouncement = {
      id: `ANN-${String(announcements.length + 1).padStart(3, '0')}`,
      title: announcementForm.title,
      content: announcementForm.content,
      target: announcementForm.target,
      priority: announcementForm.priority,
      sentAt: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    };

    setAnnouncements(prev => [newAnn, ...prev]);
    notify.success('Đã phát đi thông báo hệ thống thành công!');
    setAnnouncementForm({ title: '', content: '', target: 'all', priority: 'normal' });
  }

  // Cấu hình thanh Sidebar
  const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Tổng quan', tabId: 'overview' },
    { icon: Users, label: 'Tài khoản', tabId: 'users' },
    { icon: BookOpen, label: 'Duyệt khóa học', tabId: 'courses' },
    { icon: Calculator, label: 'Kế toán & Lương', tabId: 'payouts' },
    { icon: FileText, label: 'Hộp thư khiếu nại', tabId: 'complaints' },
    { icon: Bell, label: 'Phát thông báo', tabId: 'announcements' },
    { icon: Settings, label: 'Cài đặt hệ thống', tabId: 'settings' }
  ];

  return (
    <div className="min-h-screen bg-surface flex font-sans text-on-surface">
      {/* BACKGROUND DECORATION GRADIENT */}
      <div className="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0" />

      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          SIDEBAR ĐIỀU HƯỚNG
          ───────────────────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* LOGO BOX */}
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <button onClick={() => changeTab('overview')} className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-xl shadow-lg shadow-primary/20">
              B
            </div>
            <div>
              <p className="font-extrabold text-sm leading-tight text-on-surface">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Bảng Quản Trị</p>
            </div>
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant hover:bg-surface-container rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DANH SÁCH MENU TAB */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.tabId;
            return (
              <button
                key={item.tabId}
                onClick={() => changeTab(item.tabId)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all relative ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-md shadow-primary/25'
                    : 'text-on-surface-variant hover:bg-surface-container/60 hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {/* Phản hồi trạng thái cảnh báo trên menu */}
                {item.tabId === 'payouts' && (overview?.overdueTeacherCount ?? 0) > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[10px] flex items-center justify-center animate-pulse">
                    {overview?.overdueTeacherCount}
                  </span>
                )}
                {item.tabId === 'courses' && pendingTotal > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[10px] flex items-center justify-center font-bold">
                    {pendingTotal}
                  </span>
                )}
                {item.tabId === 'complaints' && complaintPendingCount > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                    {complaintPendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* SIDEBAR FOOTER - LOGOUT */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/30">
          <div className="flex items-center gap-3 px-2 py-3 mb-3">
            <img
              src="https://ui-avatars.com/api/?name=Admin+Bee&background=ad2c00&color=fff&bold=true&size=64"
              alt="Admin"
              className="w-10 h-10 rounded-full border-2 border-primary/20"
            />
            <div className="min-w-0">
              <p className="font-extrabold text-sm truncate">Admin Bee</p>
              <p className="text-[11px] text-on-surface-variant font-medium">Hệ thống cấp cao</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────────────
          KHU VỰC CHÍNH (MAIN LAYOUT CONTAINER)
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        
        {/* HEADER CHÍNH */}
        <header className="sticky top-0 z-20 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-extrabold text-xl text-on-surface flex items-center gap-2 capitalize">
              {activeTab === 'overview' && 'Tổng quan hệ thống'}
              {activeTab === 'users' && 'Quản lý tài khoản'}
              {activeTab === 'courses' && 'Phê duyệt khóa học'}
              {activeTab === 'payouts' && 'Đối soát & thanh toán giáo viên'}
              {activeTab === 'complaints' && 'Xử lý khiếu nại'}
              {activeTab === 'announcements' && 'Phát thông báo'}
              {activeTab === 'settings' && 'Cấu hình hệ thống'}
            </h1>
          </div>

          {/* CHUÔNG THÔNG BÁO VÀ THÔNG TIN PROFILE */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => changeTab('complaints')} 
              className="relative p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition-all"
            >
              <Bell className="w-5 h-5" />
              {complaintPendingCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  {complaintPendingCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/30">
              <span className="text-right hidden sm:block">
                <p className="text-xs font-bold text-on-surface leading-none">Admin Bee</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Mã số: ADM-007</p>
              </span>
              <img
                src="https://ui-avatars.com/api/?name=Admin+Bee&background=ad2c00&color=fff&bold=true&size=64"
                alt="Avatar"
                className="w-9 h-9 rounded-full border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        {/* NỘI DUNG CHÍNH THEO TAB CHỌN */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >

              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: OVERVIEW (TỔNG QUAN HỆ THỐNG - UC34)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Banner chào mừng */}
                  <div className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 top-0 opacity-15 flex items-center justify-center pointer-events-none">
                      <LayoutDashboard className="w-64 h-64 -mr-16 -mb-16 text-white" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold">Chào mừng trở lại, Admin Bee! 👋</h2>
                    <p className="text-on-primary/80 mt-1 text-sm md:text-base max-w-xl">
                      Bee Academy đang vận hành ổn định. Dưới đây là tình hình tài chính tổng thể và dữ liệu kiểm duyệt khóa học ngày hôm nay.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>

                  {/* 4 Thẻ chỉ số tài chính và hoạt động */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Thẻ 1: Tổng tiền công ty đang nắm giữ (UC34) */}
                    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tổng tiền đang giữ</span>
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                          <Wallet className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-on-surface">{overview ? `${overview.totalFundsHeld.toLocaleString('vi-VN')}đ` : '…'}</p>
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1 font-semibold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Gồm quỹ công ty + tiền chờ GV
                      </p>
                    </div>

                    {/* Thẻ 2: Tiền cần chuyển cho GV trong kỳ này */}
                    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tiền cần chuyển kỳ này</span>
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <Calculator className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-on-surface">{overview ? `${overview.totalPendingPayout.toLocaleString('vi-VN')}đ` : '…'}</p>
                      <p className="text-xs text-on-surface-variant mt-2 font-medium">
                        Phân bổ 70% doanh thu cho giáo viên
                      </p>
                    </div>

                    {/* Thẻ 3: Cảnh báo giáo viên trễ hạn chuyển lương (UC34) */}
                    <div className={`border rounded-2xl p-5 shadow-sm transition-all relative ${
                      (overview?.overdueTeacherCount ?? 0) > 0
                        ? 'bg-red-50 border-red-200 hover:shadow-red-100/50'
                        : 'bg-surface-container-lowest border-outline-variant/40 hover:shadow-md'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cảnh báo trễ hạn</span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          (overview?.overdueTeacherCount ?? 0) > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-on-surface">{overview?.overdueTeacherCount ?? 0} giáo viên</p>
                      <p className={`text-xs mt-2 font-bold ${(overview?.overdueTeacherCount ?? 0) > 0 ? 'text-red-600' : 'text-on-surface-variant'}`}>
                        {(overview?.overdueTeacherCount ?? 0) > 0 ? 'Cần chuyển khoản và đối soát gấp!' : 'Đã thanh toán đúng kỳ hạn'}
                      </p>
                    </div>

                    {/* Thẻ 4: Tổng số học viên */}
                    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tổng học viên đăng ký</span>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-on-surface">
                        {userStats ? userStats.students.toLocaleString('vi-VN') : '…'}
                      </p>
                      {userStats && (
                        <p className="text-xs text-on-surface-variant mt-1 font-semibold">
                          {userStats.teachers} GV · {userStats.parents} PH · tổng {userStats.total}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bảng Đơn hàng gần đây và Biểu đồ khóa học bán chạy */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Danh sách đơn hàng gần đây */}
                    <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                      <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
                        <h3 className="font-extrabold text-on-surface">Đơn hàng vừa thanh toán</h3>
                        <Link to="/admin" onClick={(e) => { e.preventDefault(); changeTab('payouts'); }} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                          Xem chi tiết tài chính <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                              <th className="text-left px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Học sinh</th>
                              <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase hidden md:table-cell">Khóa học</th>
                              <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Số tiền</th>
                              <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(overview?.recentOrders ?? []).map((order, idx) => (
                              <tr key={order.id} className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/20' : ''}`}>
                                <td className="px-6 py-3.5">
                                  <p className="font-bold text-on-surface">{order.studentName}</p>
                                  <p className="text-[10px] text-on-surface-variant font-mono">{order.paymentRef}</p>
                                </td>
                                <td className="px-4 py-3.5 text-on-surface-variant hidden md:table-cell">
                                  <span className="line-clamp-1 max-w-[200px]">{order.courseTitles}</span>
                                </td>
                                <td className="px-4 py-3.5 font-extrabold text-on-surface">
                                  {order.amount.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                    Thành công
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {overview && overview.recentOrders.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                                  Chưa có đơn hàng nào được thanh toán.
                                </td>
                              </tr>
                            )}
                            {!overview && (
                              <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                                  Đang tải dữ liệu…
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Biểu đồ thanh ngang Top khóa học bán chạy */}
                    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-extrabold text-on-surface">Bảng xếp hạng khóa học</h3>
                        <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-bold uppercase">
                          Số học sinh
                        </span>
                      </div>
                      <div className="space-y-4">
                        {(overview?.topCourses ?? []).map((course, idx, arr) => {
                          const maxStudents = arr[0].enrollmentCount || 1;
                          const percent = (course.enrollmentCount / maxStudents) * 100;
                          return (
                            <div key={course.id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-on-surface line-clamp-1 flex-1 pr-3">{course.title}</span>
                                <span className="font-extrabold text-on-surface-variant">{course.enrollmentCount.toLocaleString('vi-VN')} em</span>
                              </div>
                              <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-primary"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ delay: 0.1 + idx * 0.1, duration: 0.7 }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-on-surface-variant">
                                <span>Giáo viên: {course.teacherName}</span>
                                {course.categoryName && <span className="font-bold text-primary">{course.categoryName}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {overview && overview.topCourses.length === 0 && (
                          <p className="text-center text-sm text-on-surface-variant py-8">Chưa có khóa học nào được xuất bản.</p>
                        )}
                        {!overview && (
                          <p className="text-center text-sm text-on-surface-variant py-8">Đang tải dữ liệu…</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lối tắt các hành động quản trị nhanh */}
                  <div>
                    <h3 className="font-extrabold text-on-surface mb-3.5 flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-primary" />
                      Lối tắt hành động nhanh
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button
                        onClick={() => changeTab('courses')}
                        className="p-4 bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/50 rounded-2xl flex flex-col text-left group transition-all"
                      >
                        <BookOpen className="w-7 h-7 text-primary mb-2" />
                        <p className="font-bold text-sm">Duyệt khóa học</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {pendingTotal} bài chờ duyệt
                        </p>
                      </button>
                      
                      <button
                        onClick={() => changeTab('users')}
                        className="p-4 bg-surface-container-lowest border border-outline-variant/30 hover:border-blue-500/50 rounded-2xl flex flex-col text-left group transition-all"
                      >
                        <Users className="w-7 h-7 text-blue-500 mb-2" />
                        <p className="font-bold text-sm">Thêm học viên/GV</p>
                        <p className="text-xs text-on-surface-variant mt-1">Cấp tài khoản mới</p>
                      </button>

                      <button
                        onClick={() => changeTab('payouts')}
                        className="p-4 bg-surface-container-lowest border border-outline-variant/30 hover:border-green-500/50 rounded-2xl flex flex-col text-left group transition-all"
                      >
                        <DollarSign className="w-7 h-7 text-green-500 mb-2" />
                        <p className="font-bold text-sm">Đối soát & Chuyển lương</p>
                        <p className="text-xs text-on-surface-variant mt-1">Thanh toán hoa hồng GV</p>
                      </button>

                      <button
                        onClick={() => changeTab('announcements')}
                        className="p-4 bg-surface-container-lowest border border-outline-variant/30 hover:border-amber-500/50 rounded-2xl flex flex-col text-left group transition-all"
                      >
                        <Megaphone className="w-7 h-7 text-amber-500 mb-2" />
                        <p className="font-bold text-sm">Phát thông báo chung</p>
                        <p className="text-xs text-on-surface-variant mt-1">Gửi tin nhắn đẩy</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2: USERS (QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG - UC35)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'users' && (
                <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">Danh sách thành viên trên hệ thống</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">Admin quản lý thông tin, chặn/mở chặn và đổi vai trò tài khoản.</p>
                    {userStats && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {userStats.students.toLocaleString('vi-VN')} Học sinh
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {userStats.teachers.toLocaleString('vi-VN')} Giáo viên
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          {userStats.parents.toLocaleString('vi-VN')} Phụ huynh
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold">
                          Tổng {userStats.total.toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thanh tìm kiếm và bộ lọc */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                      <input
                        type="text"
                        placeholder="Tìm theo tên học sinh, email, ID..."
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <select
                          value={filterUserRole}
                          onChange={(e) => setFilterUserRole(e.target.value)}
                          className="pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="all">Tất cả vai trò</option>
                          <option value="student">Học sinh</option>
                          <option value="teacher">Giáo viên</option>
                          <option value="parent">Phụ huynh</option>
                        </select>
                        <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Bảng danh sách người dùng — API thật */}
                  <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                    {loadingUsers && (
                      <div className="flex items-center justify-center py-12 gap-3 text-on-surface-variant">
                        <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                        Đang tải danh sách...
                      </div>
                    )}
                    {!loadingUsers && (
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Hội viên</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Email</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Vai trò</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Ngày tham gia</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">
                              Không tìm thấy người dùng nào.
                            </td>
                          </tr>
                        ) : (
                          apiUsers.map((user, idx) => (
                            <tr key={user.id} className={`border-b border-outline-variant/10 hover:bg-surface-container/20 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/20' : ''}`}>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&size=32&background=random&bold=true`}
                                    alt={user.fullName ?? ''}
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <p className="font-bold text-on-surface">{user.fullName ?? '(Chưa đặt tên)'}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant text-xs font-mono">{user.email ?? '—'}</td>
                              <td className="px-4 py-3.5 font-bold">
                                {user.role === 'student' && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">Học sinh</span>}
                                {user.role === 'teacher' && <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-full text-xs">Giáo viên</span>}
                                {user.role === 'parent' && <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs">Phụ huynh</span>}
                                {user.role === 'admin' && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-xs">Admin</span>}
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant font-medium text-xs">
                                {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  !user.isBlocked ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${!user.isBlocked ? 'bg-green-600' : 'bg-red-600'}`} />
                                  {!user.isBlocked ? 'Hoạt động' : 'Bị khóa'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                {user.role !== 'admin' ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <select
                                      value={user.role}
                                      onChange={(e) => handleChangeRole(user.id, e.target.value as AdminUser['role'])}
                                      className="text-xs border border-outline-variant/30 rounded-lg px-2 py-1 bg-surface-container-low focus:outline-none focus:border-primary cursor-pointer"
                                    >
                                      <option value="student">Học sinh</option>
                                      <option value="teacher">Giáo viên</option>
                                      <option value="parent">Phụ huynh</option>
                                    </select>
                                    <button
                                      onClick={() => handleToggleBlockUser(user.id)}
                                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                        !user.isBlocked ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'
                                      }`}
                                      title={!user.isBlocked ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                    >
                                      {!user.isBlocked ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="flex justify-end text-xs text-on-surface-variant italic">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    )}
                  </div>

                  {/* Phân trang */}
                  {userTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button disabled={userPage === 0} onClick={() => loadUsers(userPage - 1)}
                        className="px-3 py-1.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-lg disabled:opacity-40">
                        ← Trước
                      </button>
                      <span className="text-sm text-on-surface-variant">Trang {userPage + 1} / {userTotalPages}</span>
                      <button disabled={userPage >= userTotalPages - 1} onClick={() => loadUsers(userPage + 1)}
                        className="px-3 py-1.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-lg disabled:opacity-40">
                        Sau →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: COURSES (DUYỆT KHÓA HỌC - UC36) → Redirect thật
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'courses' && (
                <div className="space-y-5">
                  <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <h2 className="text-lg font-bold">Duyệt khóa học</h2>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Trang duyệt khóa học đầy đủ tính năng — xem nội dung, phê duyệt, từ chối, yêu cầu sửa.
                        </p>
                      </div>
                      <Link to="/admin/approvals"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 text-sm"
                      >
                        <BookOpen className="w-4 h-4" />
                        Mở trang duyệt khóa học →
                      </Link>
                    </div>
                  </div>

                  {/* Preview 5 khóa học đang chờ duyệt */}
                  <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-on-surface flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Đang chờ duyệt ({pendingTotal})
                      </h3>
                      <Link to="/admin/approvals" className="text-xs font-bold text-primary hover:underline">
                        Xem tất cả →
                      </Link>
                    </div>
                    {loadingPending ? (
                      <p className="text-sm text-on-surface-variant text-center py-4">Đang tải...</p>
                    ) : pendingCourses.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-6">Không có khóa học nào chờ duyệt.</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingCourses.map(c => (
                          <Link key={c.id} to={`/admin/approvals/${c.id}`}
                            className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container/40 transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-sm text-on-surface line-clamp-1">{c.title}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">GV: {c.teacherName}</p>
                            </div>
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold whitespace-nowrap ml-3">
                              Chờ duyệt
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: PAYOUTS & SALARY (KẾ TOÁN ĐỐI SOÁT - UC37, UC39, UC40)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'payouts' && <PayoutsPanel />}


              {/* ─────────────────────────────────────────────────────────────
                  TAB 5: COMPLAINTS (HỘP THƯ KHIẾU NẠI - UC38)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'complaints' && <ComplaintsInbox onStatsChange={loadComplaintBadge} />}


              {/* ─────────────────────────────────────────────────────────────
                  TAB 6: ANNOUNCEMENTS (GỬI THÔNG BÁO HỆ THỐNG - UC41)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'announcements' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Cột soạn thảo */}
                  <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm self-start space-y-4">
                    <div>
                      <h2 className="text-lg font-bold">Soạn thông báo mới</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">Phát tin tức hệ thống thời gian thực đến tất cả các đối tượng mục tiêu.</p>
                    </div>

                    <form onSubmit={handleSendAnnouncement} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase">Tiêu đề thông báo</label>
                        <input
                          type="text"
                          required
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Ví dụ: Lịch nghỉ lễ / Hướng dẫn thanh toán mới..."
                          className="w-full px-3.5 py-2 border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary bg-surface-container-low"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-on-surface-variant uppercase">Đối tượng nhận</label>
                          <select
                            value={announcementForm.target}
                            onChange={(e) => setAnnouncementForm(prev => ({ ...prev, target: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-outline-variant/30 rounded-xl text-sm focus:outline-none bg-surface-container-low"
                          >
                            <option value="all">Tất cả người dùng</option>
                            <option value="students">Học sinh</option>
                            <option value="teachers">Giáo viên</option>
                            <option value="parents">Phụ huynh</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-on-surface-variant uppercase">Độ ưu tiên</label>
                          <select
                            value={announcementForm.priority}
                            onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-outline-variant/30 rounded-xl text-sm focus:outline-none bg-surface-container-low"
                          >
                            <option value="low">Thấp</option>
                            <option value="normal">Bình thường</option>
                            <option value="high">Khẩn cấp (High)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-on-surface-variant uppercase">Nội dung chi tiết</label>
                        <textarea
                          required
                          rows={4}
                          value={announcementForm.content}
                          onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Nhập nội dung thông báo tại đây..."
                          className="w-full px-3.5 py-2 border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary bg-surface-container-low"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-sm hover:bg-primary-container shadow-md transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Phát thông báo hệ thống
                      </button>
                    </form>
                  </div>

                  {/* Cột Lịch sử gửi */}
                  <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-bold">Lịch sử thông báo đã gửi</h2>
                    
                    <div className="space-y-4">
                      {announcements.map(ann => (
                        <div key={ann.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-2 relative overflow-hidden">
                          {/* Dấu màu đỏ góc khẩn cấp */}
                          {ann.priority === 'high' && (
                            <div className="absolute right-0 top-0 h-full w-1.5 bg-red-500" />
                          )}
                          <div className="flex justify-between items-start gap-4">
                            <h3 className="font-extrabold text-on-surface text-sm">{ann.title}</h3>
                            <span className="text-[9px] text-on-surface-variant font-semibold flex-shrink-0 mt-0.5">{ann.sentAt}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{ann.content}</p>
                          <div className="flex items-center gap-2 pt-1.5">
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Tới: {
                                ann.target === 'all' ? 'Tất cả' :
                                ann.target === 'students' ? 'Học sinh' :
                                ann.target === 'teachers' ? 'Giáo viên' : 'Phụ huynh'
                              }
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              ann.priority === 'high' ? 'bg-red-100 text-red-700' :
                              ann.priority === 'normal' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              Độ ưu tiên: {ann.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 7: SETTINGS (CẤU HÌNH HỆ THỐNG)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'settings' && (
                <div className="max-w-2xl bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">Cài đặt & Cấu hình máy chủ</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">Tùy biến các tham số hoạt động chung của toàn bộ nền tảng học Bee Academy.</p>
                  </div>

                  <div className="space-y-5">
                    {/* Tỷ lệ phí nền tảng */}
                    <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                      <div>
                        <p className="font-bold text-sm text-on-surface">Tỷ lệ chiết khấu phí nền tảng (Platform Fee)</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Tỷ lệ phần trăm doanh thu giữ lại khi học sinh mua khóa học.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={platformFeePercent}
                          onChange={(e) => setPlatformFeePercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-16 px-2 py-1 bg-surface-container border border-outline-variant/30 rounded-lg text-center font-bold focus:outline-none"
                        />
                        <span className="font-bold text-sm">%</span>
                      </div>
                    </div>

                    {/* Chế độ bảo trì hệ thống */}
                    <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                      <div>
                        <p className="font-bold text-sm text-on-surface">Chế độ bảo trì máy chủ (Maintenance Mode)</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">Chặn tất cả lưu lượng của khách và học sinh để sửa lỗi phần cứng.</p>
                      </div>
                      <button
                        onClick={() => {
                          const newState = !maintenanceMode;
                          setMaintenanceMode(newState);
                          notify.info(`Đã ${newState ? 'Kích hoạt' : 'Tắt'} chế độ bảo trì hệ thống!`);
                        }}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                          maintenanceMode ? 'bg-red-500' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 transform ${
                          maintenanceMode ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <button
                      onClick={() => notify.success('Đã cập nhật các cấu hình hệ thống!')}
                      className="px-6 py-2 bg-primary text-on-primary font-bold rounded-xl text-sm shadow-md hover:bg-primary-container transition-colors"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MODALS & FORM POPUPS
          ───────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        
        {/* 1. MODAL TẠO / SỬA USER (UC35) */}
        {/* 2. MODAL TỪ CHỐI / CẦN SỬA KHÓA HỌC (UC36) */}
        {courseActionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setCourseActionModal({ isOpen: false, course: null, action: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 shadow-2xl z-10 relative overflow-hidden"
            >
              <h3 className="text-lg font-bold text-on-surface mb-1">
                {courseActionModal.action === 'reject' ? 'Từ chối duyệt khóa học' : 'Yêu cầu giáo viên sửa đổi'}
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Khóa học: <span className="font-bold text-on-surface">{courseActionModal.course?.title}</span>
              </p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Lý do & Ghi chú phản hồi</label>
                  <textarea
                    required
                    rows={4}
                    value={courseReason}
                    onChange={(e) => setCourseReason(e.target.value)}
                    placeholder="Vui lòng nêu rõ các điểm cần bổ sung, chỉnh sửa hoặc nguyên nhân không duyệt..."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitCourseAction}
                    className={`flex-1 py-2 text-white rounded-xl text-sm font-bold transition-colors ${
                      courseActionModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Xác nhận
                  </button>
                  <button
                    onClick={() => setCourseActionModal({ isOpen: false, course: null, action: null })}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
