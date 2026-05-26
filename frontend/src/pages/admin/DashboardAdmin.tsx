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

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, Users, ShoppingBag,
  FileText, TrendingUp, TrendingDown, DollarSign,
  Star, ChevronRight, Bell, LogOut, Menu, X,
  CheckCircle2, Clock, XCircle, PlusCircle, Calculator, Wallet, BarChart2, Settings,
  AlertTriangle, Search, Filter, Download, Send, Check, Ban, MessageSquare, AlertCircle, Calendar, Hash, Megaphone, CheckCircle, ShieldAlert, Edit2, RotateCcw
} from 'lucide-react';
import { MOCK_COURSES } from '../../data/mockCourses';

// ─────────────────────────────────────────────────────────────────────────────
// KIỂU DỮ LIỆU (Types & Interfaces)
// ─────────────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  student: string;
  course: string;
  amount: number;
  date: string;
  status: 'success' | 'pending' | 'failed';
}

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

interface TeacherPayout {
  id: string;
  teacherName: string;
  bankName: string;
  bankAccount: string;
  bankAccountHolder: string;
  totalRevenue: number;
  platformFee: number;
  teacherShare: number;
  status: 'paid' | 'pending' | 'overdue';
  overdueDays?: number;
  paymentDate?: string;
  txnHash?: string;
  notes?: string;
}

interface Complaint {
  id: string;
  senderName: string;
  senderRole: 'student' | 'parent';
  title: string;
  type: 'payment' | 'content' | 'system' | 'other';
  content: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'rejected';
  responseNote?: string;
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
// DỮ LIỆU KHỞI TẠO MOCK (Initial Mock Data)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ORDERS: Order[] = [
  { id: 'ORD-001', student: 'Nguyễn Văn An',   course: 'Toán Đại Số Nâng Cao',     amount: 499000, date: '18/05/2026', status: 'success' },
  { id: 'ORD-002', student: 'Trần Thị Bích',   course: 'Vật Lý Khám Phá Điện Từ',  amount: 550000, date: '18/05/2026', status: 'success' },
  { id: 'ORD-003', student: 'Lê Minh Cường',   course: 'Hóa Học Cơ Bản',           amount: 400000, date: '17/05/2026', status: 'pending' },
  { id: 'ORD-004', student: 'Phạm Thị Dung',   course: 'Văn Học Dân Gian',          amount: 350000, date: '17/05/2026', status: 'success' },
  { id: 'ORD-005', student: 'Hoàng Quốc Đạt',  course: 'Lịch Sử Kháng Chiến',      amount: 299000, date: '16/05/2026', status: 'failed'  },
  { id: 'ORD-006', student: 'Vũ Ngọc Hà',      course: 'Toán Hình Học Không Gian',  amount: 450000, date: '16/05/2026', status: 'success' },
  { id: 'ORD-007', student: 'Đỗ Thanh Hùng',   course: 'Địa Lý Khí Hậu Vùng Miền', amount: 250000, date: '15/05/2026', status: 'success' },
];

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

const INITIAL_PAYOUTS: TeacherPayout[] = [
  { id: 'PAY-001', teacherName: 'Thầy Trần Hữu Nam', bankName: 'Vietcombank', bankAccount: '1023456789', bankAccountHolder: 'TRAN HUU NAM', totalRevenue: 25000000, platformFee: 5000000, teacherShare: 20000000, status: 'pending' },
  { id: 'PAY-002', teacherName: 'Cô Nguyễn Thị Hoa', bankName: 'Techcombank', bankAccount: '1903456789012', bankAccountHolder: 'NGUYEN THI HOA', totalRevenue: 18000000, platformFee: 3600000, teacherShare: 14400000, status: 'overdue', overdueDays: 3 },
  { id: 'PAY-003', teacherName: 'Thầy Mike Robinson', bankName: 'BIDV', bankAccount: '2151000123456', bankAccountHolder: 'MIKE ROBINSON', totalRevenue: 15000000, platformFee: 3000000, teacherShare: 12000000, status: 'paid', paymentDate: '10/05/2026', txnHash: 'FT261309852230', notes: 'Đã thanh toán lương kỳ 1 tháng 5/2026.' },
  { id: 'PAY-004', teacherName: 'Cô Lê Thị Kim Anh', bankName: 'Agribank', bankAccount: '3100205123456', bankAccountHolder: 'LE THI KIM ANH', totalRevenue: 8000000, platformFee: 1600000, teacherShare: 6400000, status: 'pending' },
  { id: 'PAY-005', teacherName: 'Thầy Phạm Thanh Sơn', bankName: 'MB Bank', bankAccount: '0990123456789', bankAccountHolder: 'PHAM THANH SON', totalRevenue: 12000000, platformFee: 2400000, teacherShare: 9600000, status: 'overdue', overdueDays: 5 },
];

const INITIAL_COMPLAINTS: Complaint[] = [
  { id: 'CMP-001', senderName: 'Nguyễn Văn An', senderRole: 'student', title: 'Không mở được Quiz chương 4', type: 'system', content: 'Em đã hoàn thành 100% bài giảng của chương 3 và 4 nhưng Quiz chương 4 vẫn báo là bị khóa, nhờ Admin mở giúp.', createdAt: '20/05/2026', status: 'pending' },
  { id: 'CMP-002', senderName: 'Chị Lê Thị Mai (PH)', senderRole: 'parent', title: 'Lỗi trừ tiền VNPay nhưng chưa kích hoạt khóa học', type: 'payment', content: 'Tôi đã đóng tiền khóa Toán lớp 9 cho con Lê Minh Cường qua VNPay lúc 9h sáng nay, tài khoản đã bị trừ 599.000đ nhưng tài khoản của cháu vẫn chưa mở được bài học.', createdAt: '20/05/2026', status: 'pending' },
  { id: 'CMP-003', senderName: 'Trần Thị Bích', senderRole: 'student', title: 'Đánh giá sai kết quả bài tập tự luận', type: 'content', content: 'Bài tập làm văn chương 2 em viết rất kỹ nhưng giáo viên chỉ chấm 5 điểm và không có lời nhận xét sửa bài nào cả.', createdAt: '15/05/2026', status: 'resolved', responseNote: 'Admin đã liên hệ giáo viên để chấm lại bài viết và yêu cầu giáo viên ghi lời nhận xét chi tiết. Đã nâng điểm lên 8.5.' },
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
  const [payouts, setPayouts] = useState<TeacherPayout[]>(INITIAL_PAYOUTS);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(INITIAL_ANNOUNCEMENTS);

  // State cấu hình hệ thống
  const [platformFeePercent, setPlatformFeePercent] = useState(20);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // STATE CHO CÁC BIỂU MẪU & MODALS
  // ───────────────────────────────────────────────────────────────────────────
  // Modal Quản lý Người dùng
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'student' as UserAccount['role'] });

  // Modal Phê duyệt Khóa học (Từ chối / Cần chỉnh sửa)
  const [courseActionModal, setCourseActionModal] = useState<{ isOpen: boolean; course: CourseApproval | null; action: 'reject' | 'revision' | null }>({
    isOpen: false, course: null, action: null
  });
  const [courseReason, setCourseReason] = useState('');

  // Modal Đối soát chuyển khoản
  const [payoutModal, setPayoutModal] = useState<{ isOpen: boolean; payout: TeacherPayout | null }>({ isOpen: false, payout: null });
  const [payoutForm, setPayoutForm] = useState({ txnHash: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });

  // Modal Xử lý khiếu nại
  const [complaintModal, setComplaintModal] = useState<{ isOpen: boolean; complaint: Complaint | null }>({ isOpen: false, complaint: null });
  const [complaintReply, setComplaintReply] = useState('');

  // Biểu mẫu gửi thông báo mới
  const [announcementForm, setAnnouncementForm] = useState({
    title: '', content: '', target: 'all' as SystemAnnouncement['target'], priority: 'normal' as SystemAnnouncement['priority']
  });

  // Tìm kiếm và lọc
  const [searchUser, setSearchUser] = useState('');
  const [filterUserRole, setFilterUserRole] = useState<string>('all');
  const [searchPayout, setSearchPayout] = useState('');
  const [filterPayoutStatus, setFilterPayoutStatus] = useState<string>('all');
  const [filterCourseStatus, setFilterCourseStatus] = useState<string>('all');
  const [filterComplaintStatus, setFilterComplaintStatus] = useState<string>('all');

  // ───────────────────────────────────────────────────────────────────────────
  // TÍNH TOÁN CÁC THÔNG SỐ TÀI CHÍNH DỰA TRÊN STATE ĐỘNG (UC34 & UC37)
  // ───────────────────────────────────────────────────────────────────────────
  const financialStats = useMemo(() => {
    const totalGMV = payouts.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalPlatformFee = payouts.reduce((sum, p) => sum + p.platformFee, 0);
    
    // Tổng số tiền giáo viên đã thanh toán
    const totalPaidToTeachers = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.teacherShare, 0);

    // Tổng số tiền giáo viên chờ thanh toán
    const totalUnpaidTeacherShare = payouts
      .filter(p => p.status !== 'paid')
      .reduce((sum, p) => sum + p.teacherShare, 0);

    // Tổng tiền công ty đang giữ = Toàn bộ platform_fee thu được + Số tiền giáo viên chưa chuyển khoản
    const totalFundsHeld = totalPlatformFee + totalUnpaidTeacherShare;
    
    // Cảnh báo số lượng giáo viên quá hạn thanh toán
    const overdueCount = payouts.filter(p => p.status === 'overdue').length;

    return {
      totalGMV,
      totalPlatformFee,
      totalPaidToTeachers,
      totalFundsHeld,
      totalPendingPayout: totalUnpaidTeacherShare,
      overdueCount
    };
  }, [payouts]);

  // Tổng số học viên (mock dynamic)
  const totalStudentsCount = useMemo(() => {
    const studentsInCourses = MOCK_COURSES.reduce((sum, c) => sum + c.students, 0);
    const registeredUsersCount = users.filter(u => u.role === 'student').length;
    return studentsInCourses + registeredUsersCount;
  }, [users]);

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
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase());
      const matchRole = filterUserRole === 'all' || u.role === filterUserRole;
      return matchSearch && matchRole;
    });
  }, [users, searchUser, filterUserRole]);

  function handleToggleBlockUser(userId: string) {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'active' ? 'blocked' : 'active';
        notify.success(`Đã ${newStatus === 'blocked' ? 'khóa' : 'kích hoạt lại'} tài khoản ${u.name}`);
        return { ...u, status: newStatus };
      }
      return u;
    }));
  }

  function handleOpenUserModal(user: UserAccount | null) {
    setSelectedUser(user);
    if (user) {
      setUserForm({ name: user.name, email: user.email, role: user.role });
    } else {
      setUserForm({ name: '', email: '', role: 'student' });
    }
    setIsUserModalOpen(true);
  }

  function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name || !userForm.email) {
      notify.error('Vui lòng nhập đầy đủ tên và email!');
      return;
    }

    if (selectedUser) {
      // Edit
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...userForm } : u));
      notify.success('Cập nhật tài khoản thành công!');
    } else {
      // Add
      const newUser: UserAccount = {
        id: `USR-${String(users.length + 1).padStart(3, '0')}`,
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        status: 'active',
        createdAt: new Date().toLocaleDateString('vi-VN')
      };
      setUsers(prev => [newUser, ...prev]);
      notify.success('Tạo tài khoản mới thành công!');
    }
    setIsUserModalOpen(false);
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
  // WORKFLOW 3: ĐỐI SOÁT & THANH TOÁN (UC39, UC40)
  // ───────────────────────────────────────────────────────────────────────────
  const filteredPayouts = useMemo(() => {
    return payouts.filter(p => {
      const matchSearch = p.teacherName.toLowerCase().includes(searchPayout.toLowerCase());
      const matchStatus = filterPayoutStatus === 'all' || p.status === filterPayoutStatus;
      return matchSearch && matchStatus;
    });
  }, [payouts, searchPayout, filterPayoutStatus]);

  // UC39: Xuất báo cáo thanh toán doanh thu đến GV dưới dạng CSV (Excel-compatible)
  function handleExportCSV() {
    const headers = ['Mã thanh toán', 'Tên giáo viên', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Tổng doanh thu (đ)', 'Phí nền tảng (đ)', 'Thực nhận (đ)', 'Trạng thái'];
    const rows = payouts.map(p => [
      p.id,
      p.teacherName,
      p.bankName,
      `'${p.bankAccount}`, // Tránh Excel tự động convert thành số mũ khoa học
      p.bankAccountHolder,
      p.totalRevenue,
      p.platformFee,
      p.teacherShare,
      p.status === 'paid' ? 'Đã thanh toán' : p.status === 'overdue' ? 'Trễ hạn' : 'Chờ thanh toán'
    ]);
    
    // Định dạng CSV hỗ trợ tiếng Việt có dấu trong Excel (dùng UTF-8 BOM \uFEFF)
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_Thanh_Toan_GV_${new Date().getMonth()+1}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Xuất file báo cáo thanh toán thành công!');
  }

  function handleOpenPayoutModal(payout: TeacherPayout) {
    setPayoutModal({ isOpen: true, payout });
    setPayoutForm({ txnHash: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });
  }

  // UC40: Xác nhận đã chuyển khoản ngân hàng thủ công cho giáo viên
  function handleConfirmPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutForm.txnHash.trim()) {
      notify.error('Vui lòng nhập Mã giao dịch ngân hàng!');
      return;
    }
    const payout = payoutModal.payout;
    if (!payout) return;

    setPayouts(prev => prev.map(p => {
      if (p.id === payout.id) {
        return {
          ...p,
          status: 'paid' as const,
          txnHash: payoutForm.txnHash,
          notes: payoutForm.notes,
          paymentDate: payoutForm.paymentDate
        };
      }
      return p;
    }));

    notify.success(`Đã xác nhận thanh toán thành công ${payout.teacherShare.toLocaleString('vi-VN')}đ cho ${payout.teacherName}!`);
    setPayoutModal({ isOpen: false, payout: null });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WORKFLOW 4: XỬ LÝ KHIẾU NẠI (UC38)
  // ───────────────────────────────────────────────────────────────────────────
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => filterComplaintStatus === 'all' || c.status === filterComplaintStatus);
  }, [complaints, filterComplaintStatus]);

  function handleResolveComplaint(status: 'resolved' | 'rejected') {
    if (!complaintReply.trim()) {
      notify.error('Vui lòng nhập nội dung xử lý/phản hồi!');
      return;
    }
    const complaint = complaintModal.complaint;
    if (!complaint) return;

    setComplaints(prev => prev.map(c => {
      if (c.id === complaint.id) {
        return { ...c, status, responseNote: complaintReply };
      }
      return c;
    }));

    notify.success(status === 'resolved' ? 'Đã giải quyết khiếu nại thành công!' : 'Đã bác bỏ khiếu nại!');
    setComplaintModal({ isOpen: false, complaint: null });
    setComplaintReply('');
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
                {item.tabId === 'payouts' && financialStats.overdueCount > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[10px] flex items-center justify-center animate-pulse">
                    {financialStats.overdueCount}
                  </span>
                )}
                {item.tabId === 'courses' && coursesApproval.filter(c => c.status === 'pending').length > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[10px] flex items-center justify-center font-bold">
                    {coursesApproval.filter(c => c.status === 'pending').length}
                  </span>
                )}
                {item.tabId === 'complaints' && complaints.filter(c => c.status === 'pending').length > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                    {complaints.filter(c => c.status === 'pending').length}
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
              {complaints.filter(c => c.status === 'pending').length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  {complaints.filter(c => c.status === 'pending').length}
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
                      <p className="text-2xl font-extrabold text-on-surface">{financialStats.totalFundsHeld.toLocaleString('vi-VN')}đ</p>
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
                      <p className="text-2xl font-extrabold text-on-surface">{financialStats.totalPendingPayout.toLocaleString('vi-VN')}đ</p>
                      <p className="text-xs text-on-surface-variant mt-2 font-medium">
                        Phân bổ 80% doanh thu thực tế
                      </p>
                    </div>

                    {/* Thẻ 3: Cảnh báo giáo viên trễ hạn chuyển lương (UC34) */}
                    <div className={`border rounded-2xl p-5 shadow-sm transition-all relative ${
                      financialStats.overdueCount > 0
                        ? 'bg-red-50 border-red-200 hover:shadow-red-100/50'
                        : 'bg-surface-container-lowest border-outline-variant/40 hover:shadow-md'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cảnh báo trễ hạn</span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          financialStats.overdueCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-2xl font-extrabold text-on-surface">{financialStats.overdueCount} giáo viên</p>
                      <p className={`text-xs mt-2 font-bold ${financialStats.overdueCount > 0 ? 'text-red-600' : 'text-on-surface-variant'}`}>
                        {financialStats.overdueCount > 0 ? 'Cần chuyển khoản và đối soát gấp!' : 'Đã thanh toán đúng kỳ hạn'}
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
                      <p className="text-2xl font-extrabold text-on-surface">{totalStudentsCount.toLocaleString('vi-VN')}</p>
                      <p className="text-xs text-blue-600 mt-2 flex items-center gap-1 font-semibold">
                        <TrendingUp className="w-3.5 h-3.5" />
                        +8.2% học viên mới tuần này
                      </p>
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
                            {MOCK_ORDERS.map((order, idx) => (
                              <tr key={order.id} className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/20' : ''}`}>
                                <td className="px-6 py-3.5">
                                  <p className="font-bold text-on-surface">{order.student}</p>
                                  <p className="text-[10px] text-on-surface-variant font-mono">{order.id}</p>
                                </td>
                                <td className="px-4 py-3.5 text-on-surface-variant hidden md:table-cell">
                                  <span className="line-clamp-1 max-w-[200px]">{order.course}</span>
                                </td>
                                <td className="px-4 py-3.5 font-extrabold text-on-surface">
                                  {order.amount.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    order.status === 'success' ? 'bg-green-100 text-green-700' :
                                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {order.status === 'success' && 'Thành công'}
                                    {order.status === 'pending' && 'Chờ xử lý'}
                                    {order.status === 'failed' && 'Lỗi'}
                                  </span>
                                </td>
                              </tr>
                            ))}
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
                        {[...MOCK_COURSES].sort((a, b) => b.students - a.students).slice(0, 5).map((course, idx, arr) => {
                          const maxStudents = arr[0].students;
                          const percent = (course.students / maxStudents) * 100;
                          return (
                            <div key={course.id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-on-surface line-clamp-1 flex-1 pr-3">{course.title}</span>
                                <span className="font-extrabold text-on-surface-variant">{course.students.toLocaleString('vi-VN')} em</span>
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
                                <span>Giáo viên: {course.instructor}</span>
                                <span className="font-bold text-primary">{course.subject} · {course.grade}</span>
                              </div>
                            </div>
                          );
                        })}
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
                          {coursesApproval.filter(c => c.status === 'pending').length} bài chờ duyệt
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">Danh sách thành viên trên hệ thống</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">Admin quản lý thông tin, chặn/mở chặn tài khoản học sinh, phụ huynh và đối tác giáo viên.</p>
                    </div>
                    <button
                      onClick={() => handleOpenUserModal(null)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-primary-container transition-colors self-start sm:self-auto"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo tài khoản mới
                    </button>
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

                  {/* Bảng danh sách người dùng */}
                  <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Hội viên</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Vai trò</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Ngày tham gia</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant">
                              Không tìm thấy người dùng nào phù hợp.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user, idx) => (
                            <tr key={user.id} className={`border-b border-outline-variant/10 hover:bg-surface-container/20 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/20' : ''}`}>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=32&background=random&bold=true`}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div>
                                    <p className="font-bold text-on-surface">{user.name}</p>
                                    <p className="text-[10px] text-on-surface-variant font-mono">{user.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-bold">
                                {user.role === 'student' && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">Học sinh</span>}
                                {user.role === 'teacher' && <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-full text-xs">Giáo viên</span>}
                                {user.role === 'parent' && <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs">Phụ huynh</span>}
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant font-medium">{user.createdAt}</td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`} />
                                  {user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenUserModal(user)}
                                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
                                    title="Sửa thông tin"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleBlockUser(user.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      user.status === 'active'
                                        ? 'text-red-500 hover:bg-red-50'
                                        : 'text-green-500 hover:bg-green-50'
                                    }`}
                                    title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                  >
                                    {user.status === 'active' ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: COURSES (DUYỆT KHÓA HỌC - UC36)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'courses' && (
                <div className="space-y-6">
                  {/* Tiêu đề & Lọc trạng thái */}
                  <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">Danh sách yêu cầu kiểm duyệt khóa học</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên upload tài liệu và nộp đề xuất. Admin xem xét phê duyệt hoặc yêu cầu chỉnh sửa trước khi bán.</p>
                    </div>
                    <div className="relative">
                      <select
                        value={filterCourseStatus}
                        onChange={(e) => setFilterCourseStatus(e.target.value)}
                        className="pl-3 pr-8 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm font-bold focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="pending">Chờ kiểm duyệt</option>
                        <option value="approved">Đã phê duyệt</option>
                        <option value="revision_required">Cần chỉnh sửa</option>
                        <option value="rejected">Bị từ chối</option>
                      </select>
                      <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
                    </div>
                  </div>

                  {/* Grid danh sách khóa học chờ duyệt */}
                  {filteredCoursesApproval.length === 0 ? (
                    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-10 text-center text-on-surface-variant shadow-sm">
                      Không có khóa học nào đang chờ xét duyệt hoặc phù hợp với bộ lọc.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredCoursesApproval.map(course => (
                        <div key={course.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">
                                {course.subject} · {course.grade}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                course.status === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                course.status === 'approved' ? 'bg-green-100 text-green-700' :
                                course.status === 'revision_required' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {course.status === 'pending' && 'Chờ kiểm duyệt'}
                                {course.status === 'approved' && 'Đã phê duyệt'}
                                {course.status === 'revision_required' && 'Cần chỉnh sửa'}
                                {course.status === 'rejected' && 'Bị từ chối'}
                              </span>
                            </div>
                            <h3 className="font-bold text-on-surface text-base line-clamp-2">{course.title}</h3>
                            <div className="space-y-1 text-xs text-on-surface-variant font-semibold">
                              <p>Giảng viên: <span className="text-on-surface font-bold">{course.teacherName}</span></p>
                              <p>Ngày nộp yêu cầu: <span className="text-on-surface font-medium">{course.submittedAt}</span></p>
                              <p>Giá đề xuất: <span className="text-primary font-bold">{course.price.toLocaleString('vi-VN')}đ</span></p>
                            </div>

                            {/* Hiển thị lý do nếu bị từ chối hoặc yêu cầu sửa */}
                            {course.reason && (
                              <div className="p-3 bg-surface-container rounded-xl text-xs border border-outline-variant/40 space-y-1">
                                <p className="font-bold text-primary flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Phản hồi của Admin:
                                </p>
                                <p className="italic text-on-surface">{course.reason}</p>
                              </div>
                            )}
                          </div>

                          {/* Nhóm thao tác phê duyệt */}
                          {course.status === 'pending' && (
                            <div className="mt-5 pt-4 border-t border-outline-variant/20 flex gap-2">
                              <button
                                onClick={() => handleApproveCourse(course.id)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Phê duyệt
                              </button>
                              <button
                                onClick={() => handleOpenCourseActionModal(course, 'revision')}
                                className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
                              >
                                Yêu cầu sửa
                              </button>
                              <button
                                onClick={() => handleOpenCourseActionModal(course, 'reject')}
                                className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
                              >
                                Từ chối
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: PAYOUTS & SALARY (KẾ TOÁN ĐỐI SOÁT - UC37, UC39, UC40)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'payouts' && (
                <div className="space-y-6">
                  {/* Bảng báo cáo doanh thu tổng quan */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Tổng doanh thu nền tảng (GMV)</p>
                      <h3 className="text-2xl font-black text-on-surface">{financialStats.totalGMV.toLocaleString('vi-VN')}đ</h3>
                      <p className="text-[10px] text-green-600 mt-1 font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        Doanh thu từ VNPay & MoMo
                      </p>
                    </div>

                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Phí vận hành giữ lại (Platform Fee {platformFeePercent}%)</p>
                      <h3 className="text-2xl font-black text-primary">{financialStats.totalPlatformFee.toLocaleString('vi-VN')}đ</h3>
                      <p className="text-[10px] text-on-surface-variant mt-1">Doanh thu ròng của công ty</p>
                    </div>

                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Tổng chi hoa hồng giáo viên (80%)</p>
                      <h3 className="text-2xl font-black text-green-600">{(financialStats.totalGMV - financialStats.totalPlatformFee).toLocaleString('vi-VN')}đ</h3>
                      <p className="text-[10px] text-on-surface-variant mt-1">
                        Đã chuyển: {financialStats.totalPaidToTeachers.toLocaleString('vi-VN')}đ
                      </p>
                    </div>
                  </div>

                  {/* Quản lý danh sách đối soát chi tiết */}
                  <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold">Danh sách thanh toán lương cho đối tác Giáo viên</h2>
                        <p className="text-xs text-on-surface-variant mt-0.5">Xuất báo cáo hàng tháng (Excel) và bấm xác nhận chuyển khoản ngân hàng thủ công cho giáo viên.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleExportCSV}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Xuất báo cáo Excel
                        </button>
                      </div>
                    </div>

                    {/* Bộ lọc thanh toán */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                        <input
                          type="text"
                          placeholder="Tìm theo tên giáo viên..."
                          value={searchPayout}
                          onChange={(e) => setSearchPayout(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="relative">
                        <select
                          value={filterPayoutStatus}
                          onChange={(e) => setFilterPayoutStatus(e.target.value)}
                          className="pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="all">Tất cả trạng thái</option>
                          <option value="paid">Đã thanh toán</option>
                          <option value="pending">Chờ thanh toán</option>
                          <option value="overdue">Trễ hạn chuyển</option>
                        </select>
                        <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
                      </div>
                    </div>

                    {/* Bảng lương chi tiết */}
                    <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                            <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Giáo viên / Số tài khoản</th>
                            <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Doanh thu kỳ này</th>
                            <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Lương (80%)</th>
                            <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                            <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPayouts.map(p => (
                            <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-container/20 transition-colors">
                              <td className="px-6 py-3.5">
                                <p className="font-bold text-on-surface">{p.teacherName}</p>
                                <p className="text-xs text-on-surface-variant font-medium">
                                  {p.bankName} · <span className="font-mono text-on-surface font-semibold">{p.bankAccount}</span> ({p.bankAccountHolder})
                                </p>
                              </td>
                              <td className="px-4 py-3.5 text-on-surface-variant font-medium">{p.totalRevenue.toLocaleString('vi-VN')}đ</td>
                              <td className="px-4 py-3.5 font-extrabold text-on-surface">{p.teacherShare.toLocaleString('vi-VN')}đ</td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  p.status === 'paid' ? 'bg-green-100 text-green-700' :
                                  p.status === 'overdue' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {p.status === 'paid' && 'Đã thanh toán'}
                                  {p.status === 'overdue' && `Trễ hạn ${p.overdueDays} ngày`}
                                  {p.status === 'pending' && 'Chờ thanh toán'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {p.status !== 'paid' ? (
                                  <button
                                    onClick={() => handleOpenPayoutModal(p)}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                                  >
                                    Xác nhận chuyển
                                  </button>
                                ) : (
                                  <div className="text-xs text-on-surface-variant font-semibold">
                                    <p className="text-green-600 font-bold">Ngày chuyển: {p.paymentDate}</p>
                                    <p className="font-mono text-[10px] mt-0.5">Mã: {p.txnHash}</p>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 5: COMPLAINTS (HỘP THƯ KHIẾU NẠI - UC38)
                  ───────────────────────────────────────────────────────────── */}
              {activeTab === 'complaints' && (
                <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold">Hộp thư khiếu nại từ Học sinh & Phụ huynh</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">Tiếp nhận khiếu nại chất lượng nội dung hoặc các lỗi cổng thanh toán, xem xét và phản hồi.</p>
                    </div>
                    <div className="relative">
                      <select
                        value={filterComplaintStatus}
                        onChange={(e) => setFilterComplaintStatus(e.target.value)}
                        className="pl-3 pr-8 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm font-bold focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="pending">Chờ xử lý</option>
                        <option value="resolved">Đã giải quyết</option>
                        <option value="rejected">Bị bác bỏ</option>
                      </select>
                      <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
                    </div>
                  </div>

                  {/* Bảng danh sách khiếu nại */}
                  <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Người gửi / Ngày gửi</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Loại khiếu nại</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Tiêu đề nội dung</th>
                          <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                          <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredComplaints.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant">
                              Không tìm thấy khiếu nại nào.
                            </td>
                          </tr>
                        ) : (
                          filteredComplaints.map(c => (
                            <tr key={c.id} className="border-b border-outline-variant/10 hover:bg-surface-container/20 transition-colors">
                              <td className="px-6 py-3.5">
                                <p className="font-bold text-on-surface">{c.senderName}</p>
                                <p className="text-xs text-on-surface-variant font-medium">
                                  {c.senderRole === 'student' ? 'Học sinh' : 'Phụ huynh'} · {c.createdAt}
                                </p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  c.type === 'payment' ? 'bg-green-50 text-green-700 border border-green-200' :
                                  c.type === 'system' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {c.type === 'payment' && 'Thanh toán'}
                                  {c.type === 'system' && 'Lỗi hệ thống'}
                                  {c.type === 'content' && 'Chất lượng học'}
                                  {c.type === 'other' && 'Khác'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-on-surface line-clamp-1">{c.title}</p>
                                <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">{c.content}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  c.status === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                  c.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {c.status === 'pending' && 'Chờ giải quyết'}
                                  {c.status === 'resolved' && 'Đã xử lý'}
                                  {c.status === 'rejected' && 'Đã bác bỏ'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <button
                                  onClick={() => { setComplaintModal({ isOpen: true, complaint: c }); setComplaintReply(c.responseNote || ''); }}
                                  className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold transition-colors"
                                >
                                  {c.status === 'pending' ? 'Xử lý ngay' : 'Xem chi tiết'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsUserModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 shadow-2xl z-10 relative overflow-hidden"
            >
              <h3 className="text-lg font-bold text-on-surface mb-1">
                {selectedUser ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản thành viên'}
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">Cung cấp thông tin truy cập hệ thống đầy đủ.</p>
              
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Địa chỉ Email</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none"
                    placeholder="email@beeacademy.edu.vn"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Phân quyền hệ thống</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(p => ({ ...p, role: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="student">Học sinh (Student)</option>
                    <option value="teacher">Giáo viên (Teacher)</option>
                    <option value="parent">Phụ huynh (Parent)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-primary-container transition-colors"
                  >
                    Lưu tài khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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

        {/* 3. MODAL XÁC NHẬN CHUYỂN KHOẢN GIÁO VIÊN (UC40) */}
        {payoutModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setPayoutModal({ isOpen: false, payout: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 shadow-2xl z-10 relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-on-surface">Nhập hóa đơn chuyển khoản</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">Lưu biên lai giao dịch thanh toán lương GV.</p>
                </div>
              </div>
              
              <div className="my-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/15 space-y-1 text-xs">
                <p className="font-semibold text-on-surface">Giáo viên: <span className="font-bold">{payoutModal.payout?.teacherName}</span></p>
                <p className="font-semibold text-on-surface">Ngân hàng: <span className="font-bold">{payoutModal.payout?.bankName}</span></p>
                <p className="font-semibold text-on-surface">Số tài khoản: <span className="font-mono font-bold text-primary">{payoutModal.payout?.bankAccount}</span></p>
                <p className="font-semibold text-on-surface">Chủ tài khoản: <span className="font-bold">{payoutModal.payout?.bankAccountHolder}</span></p>
                <p className="font-semibold text-on-surface">Số tiền cần chuyển: <span className="font-black text-green-600 text-sm">{payoutModal.payout?.teacherShare.toLocaleString('vi-VN')}đ</span></p>
              </div>

              <form onSubmit={handleConfirmPayout} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Ngày chuyển khoản
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutForm.paymentDate}
                    onChange={(e) => setPayoutForm(p => ({ ...p, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    Mã giao dịch ngân hàng (Txn Hash / Ref No.)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: FT2605987163"
                    value={payoutForm.txnHash}
                    onChange={(e) => setPayoutForm(p => ({ ...p, txnHash: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase">Ghi chú đối soát</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú thêm nếu có..."
                    value={payoutForm.notes}
                    onChange={(e) => setPayoutForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                  >
                    Xác nhận đã chuyển
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutModal({ isOpen: false, payout: null })}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 4. MODAL XỬ LÝ KHIẾU NẠI (UC38) */}
        {complaintModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setComplaintModal({ isOpen: false, complaint: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl z-10 relative overflow-hidden"
            >
              <div className="flex items-start justify-between border-b border-outline-variant/20 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-on-surface">Chi tiết đơn khiếu nại</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium">Mã số: {complaintModal.complaint?.id}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  complaintModal.complaint?.type === 'payment' ? 'bg-green-50 text-green-700 border-green-200' :
                  complaintModal.complaint?.type === 'system' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {complaintModal.complaint?.type === 'payment' && 'Thanh toán'}
                  {complaintModal.complaint?.type === 'system' && 'Lỗi hệ thống'}
                  {complaintModal.complaint?.type === 'content' && 'Chất lượng học'}
                  {complaintModal.complaint?.type === 'other' && 'Khác'}
                </span>
              </div>

              <div className="my-4 space-y-3">
                <div className="text-xs space-y-1 font-semibold">
                  <p className="text-on-surface-variant">Người gửi: <span className="text-on-surface font-extrabold">{complaintModal.complaint?.senderName}</span> ({complaintModal.complaint?.senderRole === 'student' ? 'Học sinh' : 'Phụ huynh'})</p>
                  <p className="text-on-surface-variant">Ngày gửi: <span className="text-on-surface font-medium">{complaintModal.complaint?.createdAt}</span></p>
                  <p className="text-on-surface-variant">Tiêu đề: <span className="text-on-surface font-extrabold text-sm">{complaintModal.complaint?.title}</span></p>
                </div>

                <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10 text-xs text-on-surface-variant leading-relaxed">
                  <p className="font-bold text-on-surface mb-1">Nội dung khiếu nại:</p>
                  <p className="italic">{complaintModal.complaint?.content}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Nội dung phản hồi giải quyết</label>
                  <textarea
                    rows={3}
                    required
                    value={complaintReply}
                    onChange={(e) => setComplaintReply(e.target.value)}
                    disabled={complaintModal.complaint?.status !== 'pending'}
                    placeholder="Nhập hướng xử lý, đính kèm kết quả hoặc cam kết bồi hoàn/sửa đổi nội dung học..."
                    className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {complaintModal.complaint?.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => handleResolveComplaint('resolved')}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                    >
                      Duyệt giải quyết
                    </button>
                    <button
                      onClick={() => handleResolveComplaint('rejected')}
                      className="py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors"
                    >
                      Bác bỏ
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center text-xs font-bold text-green-600 bg-green-50 p-2.5 rounded-xl border border-green-200">
                    Đơn khiếu nại đã được giải quyết hoặc bác bỏ.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setComplaintModal({ isOpen: false, complaint: null })}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
}
