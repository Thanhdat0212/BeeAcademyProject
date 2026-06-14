/**
 * TeacherComplaintsPage — Trang "Gửi khiếu nại cho Admin" (mở rộng UC11 cho GV)
 *
 * Bối cảnh:
 *   - UC11 v6.5 chỉ cho HS/PH gửi khiếu nại, nhưng GV cũng cần kênh phản ánh:
 *       + Admin chưa chuyển khoản đúng hạn / sai số tiền (UC40 lỗi)
 *       + Khóa học bị reject không thỏa đáng (UC36)
 *       + TK ngân hàng bị reject mà thông tin đúng (UC45)
 *       + HS spam/không phù hợp → cần báo cáo
 *       + Lỗi hệ thống (revenue_splits sai, upload lỗi...)
 *   - Trang này là extension UC11 cho GV. Admin xử lý qua UC38.
 *
 * Cơ chế thread:
 *   - GV gửi → tạo thread với message gốc
 *   - Admin reply → thêm message, status pending → in_progress
 *   - Admin/GV follow up → tiếp tục thread
 *   - Admin đánh dấu resolved/rejected → đóng thread
 *
 * Luồng UI:
 *   - Trên cùng: 3 stat cards tổng quan + nút "Tạo khiếu nại mới"
 *   - 2 PANEL:
 *      + Trái: list khiếu nại đã gửi (có filter loại + trạng thái)
 *      + Phải: chi tiết thread của khiếu nại đang chọn, HOẶC form tạo mới
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Send, Plus,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertTriangle,
  XCircle, Megaphone, Database, MessageSquare, AlertCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 6 loại khiếu nại — phân loại để Admin route đúng team xử lý
type ComplaintCategory =
  | 'payment'        // Thanh toán / Doanh thu (chuyển khoản sai, thiếu)
  | 'course_review'  // Duyệt khóa học (bị reject không thỏa đáng)
  | 'bank_verify'    // TK ngân hàng (Admin verify sai)
  | 'student_report' // Báo cáo HS không phù hợp / spam
  | 'technical'      // Lỗi hệ thống / hỗ trợ kỹ thuật
  | 'other';

// Mức độ ưu tiên — GV chọn khi gửi, ảnh hưởng thứ tự Admin xử lý
type Priority = 'low' | 'medium' | 'high';

// 4 trạng thái xử lý khiếu nại
//   - pending:     vừa gửi, Admin chưa xem
//   - in_progress: Admin đang xử lý (đã reply ít nhất 1 lần)
//   - resolved:    đã giải quyết xong
//   - rejected:    Admin từ chối (vd: không hợp lý)
type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

// 1 tin nhắn trong thread
interface ComplaintMessage {
  id: string;
  authorName: string;
  authorRole: 'teacher' | 'admin';
  content: string;
  sentAt: string;
}

// 1 thread khiếu nại
interface Complaint {
  id: string;
  title: string;          // Tiêu đề ngắn gọn
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;

  // messages[0] là nội dung khiếu nại gốc của GV
  messages: ComplaintMessage[];

  createdAt: string;
  lastActivityAt: string;
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — CONSTANTS: mapping label cho từng enum
// ═══════════════════════════════════════════════════════════════════

// Label tiếng Việt cho từng category — dùng ở dropdown + badge
const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  payment:        'Thanh toán / Doanh thu',
  course_review:  'Duyệt khóa học',
  bank_verify:    'TK ngân hàng',
  student_report: 'Báo cáo học sinh',
  technical:      'Lỗi kỹ thuật',
  other:          'Khác',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low:    'Thấp',
  medium: 'Trung bình',
  high:   'Cao',
};

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════
// Hardcode tên GV vì useAuthStore mặc định là HS (chưa có role-based auth)
const TEACHER_DISPLAY_NAME = 'Giáo viên Bee';

const INITIAL_COMPLAINTS: Complaint[] = [
  // Khiếu nại đang chờ Admin xem
  {
    id: 'c1',
    title: 'Chưa nhận được tiền kỳ tháng 4/2026',
    category: 'payment',
    priority: 'high',
    status: 'pending',
    createdAt: '2026-05-19T09:00:00',
    lastActivityAt: '2026-05-19T09:00:00',
    messages: [
      {
        id: 'm1',
        authorName: TEACHER_DISPLAY_NAME, authorRole: 'teacher',
        content: 'Tôi đã thấy trạng thái "Đã nhận" cho kỳ tháng 4/2026 nhưng kiểm tra TK ngân hàng vẫn chưa thấy tiền vào. Mong Admin kiểm tra giúp.',
        sentAt: '2026-05-19T09:00:00',
      },
    ],
  },
  // Khiếu nại Admin đang xử lý
  {
    id: 'c2',
    title: 'Khóa học bị Reject lần 2 — cần lý do rõ hơn',
    category: 'course_review',
    priority: 'medium',
    status: 'in_progress',
    createdAt: '2026-05-15T14:30:00',
    lastActivityAt: '2026-05-16T10:00:00',
    messages: [
      {
        id: 'm2a',
        authorName: TEACHER_DISPLAY_NAME, authorRole: 'teacher',
        content: 'Khóa "Toán nâng cao lớp 9" bị reject lần 2 với lý do "nội dung chưa đầy đủ" nhưng tôi đã thêm theo yêu cầu lần 1. Mong Admin cho biết cụ thể phần nào còn thiếu.',
        sentAt: '2026-05-15T14:30:00',
      },
      {
        id: 'm2b',
        authorName: 'Admin Trần Hữu Phước', authorRole: 'admin',
        content: 'Chúng tôi sẽ rà soát lại và phản hồi trong 2 ngày làm việc. Bạn có thể gửi thêm tài liệu cụ thể (vd: outline bài giảng) để chúng tôi đánh giá chính xác hơn.',
        sentAt: '2026-05-16T10:00:00',
      },
    ],
  },
  // Khiếu nại đã được giải quyết
  {
    id: 'c3',
    title: 'Báo cáo học sinh spam câu hỏi',
    category: 'student_report',
    priority: 'low',
    status: 'resolved',
    createdAt: '2026-05-10T16:00:00',
    lastActivityAt: '2026-05-11T09:30:00',
    messages: [
      {
        id: 'm3a',
        authorName: TEACHER_DISPLAY_NAME, authorRole: 'teacher',
        content: 'HS Nguyễn Văn X gửi liên tục 20 câu hỏi vô nghĩa trong 1 giờ. Mong Admin xem xét.',
        sentAt: '2026-05-10T16:00:00',
      },
      {
        id: 'm3b',
        authorName: 'Admin Lê Thị Mai', authorRole: 'admin',
        content: 'Đã ghi nhận. Chúng tôi đã cảnh báo tài khoản HS này và giới hạn tốc độ gửi câu hỏi. Cảm ơn bạn đã báo cáo.',
        sentAt: '2026-05-11T09:30:00',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — NAV_ITEMS (đồng bộ sidebar teacher — đã có Khiếu nại)
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
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — HELPERS
// ═══════════════════════════════════════════════════════════════════

// Format datetime ISO → "DD/MM/YYYY HH:mm"
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Format thời gian tương đối — phù hợp UX list (giống QAPage)
function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const past = new Date(iso).getTime();
  const diffMinutes = Math.floor((now - past) / 60000);

  if (diffMinutes < 1)    return 'Vừa xong';
  if (diffMinutes < 60)   return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24)     return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7)       return `${diffDays} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 6 — SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// Badge trạng thái khiếu nại
function StatusBadge({ status }: { status: ComplaintStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ xử lý',
      className: 'bg-amber-500/10 text-amber-600',
    },
    in_progress: {
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      label: 'Đang xử lý',
      className: 'bg-blue-500/10 text-blue-600',
    },
    resolved: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã giải quyết',
      className: 'bg-green-500/10 text-green-600',
    },
    rejected: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: 'Đã từ chối',
      className: 'bg-red-500/10 text-red-600',
    },
  };
  const { icon, label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>
      {icon}{label}
    </span>
  );
}

// Badge mức độ ưu tiên — màu sắc theo mức độ
function PriorityBadge({ priority }: { priority: Priority }) {
  const config = {
    low:    { className: 'bg-on-surface-variant/10 text-on-surface-variant' },
    medium: { className: 'bg-amber-500/10 text-amber-600' },
    high:   { className: 'bg-red-500/10 text-red-600' },
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${config[priority].className}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

// Bubble tin nhắn — layout 2 chiều: GV trái, Admin phải
function MessageBubble({ message }: { message: ComplaintMessage }) {
  const isAdmin = message.authorRole === 'admin';
  return (
    <div className={`flex gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
      <img
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.authorName)}&size=36&background=${isAdmin ? 'ef4444' : '7c3aed'}&color=fff&bold=true`}
        alt={message.authorName}
        className="w-8 h-8 rounded-full flex-shrink-0"
      />
      <div className={`flex flex-col max-w-[75%] ${isAdmin ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-on-surface">{message.authorName}</span>
          <span className="text-xs text-on-surface-variant">{formatRelativeTime(message.sentAt)}</span>
        </div>
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
          isAdmin
            ? 'bg-red-500/10 text-on-surface rounded-tr-sm border border-red-500/20'
            : 'bg-surface-container text-on-surface rounded-tl-sm'
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 7 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherComplaintsPage() {
  // ── State chính ─────────────────────────────────────────────────
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);

  // Bộ lọc
  const [categoryFilter, setCategoryFilter] = useState<'all' | ComplaintCategory>('all');
  const [statusFilter,   setStatusFilter]   = useState<'all' | ComplaintStatus>('all');

  // Mode panel phải:
  //   - 'view':   xem chi tiết khiếu nại đang chọn
  //   - 'create': form tạo khiếu nại mới
  //   - null:     không hiển thị gì (empty state)
  const [rightMode, setRightMode] = useState<'view' | 'create' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form tạo mới — local state để "Hủy" không ảnh hưởng dữ liệu
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ComplaintCategory>('other');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formContent, setFormContent] = useState<string>('');

  // Input reply trong thread detail
  const [replyInput, setReplyInput] = useState<string>('');

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── DERIVED: stats cho 3 cards ──────────────────────────────────
  // Tính counter cho từng trạng thái — dùng useMemo để khỏi tính lại
  // mỗi khi sidebar mở/đóng
  const stats = useMemo(() => ({
    pending:    complaints.filter(c => c.status === 'pending').length,
    inProgress: complaints.filter(c => c.status === 'in_progress').length,
    resolved:   complaints.filter(c => c.status === 'resolved' || c.status === 'rejected').length,
  }), [complaints]);

  // ── DERIVED: list đã lọc ────────────────────────────────────────
  // Sort theo lastActivityAt DESC để cái mới nhất lên đầu
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter(c => {
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        if (statusFilter   !== 'all' && c.status   !== statusFilter)   return false;
        return true;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [complaints, categoryFilter, statusFilter]);

  // Khiếu nại đang xem — null nếu không có id hoặc id không tồn tại
  const selectedComplaint = complaints.find(c => c.id === selectedId);

  // ── Handler: mở form tạo mới ────────────────────────────────────
  // Reset form về default, đóng selected (nếu có)
  function openCreateForm() {
    setFormTitle('');
    setFormCategory('other');
    setFormPriority('medium');
    setFormContent('');
    setRightMode('create');
    setSelectedId(null);
  }

  // ── Handler: hủy form tạo ───────────────────────────────────────
  function cancelCreate() {
    setRightMode(null);
  }

  // ── Handler: gửi khiếu nại mới ──────────────────────────────────
  // Validate → tạo Complaint mới với 1 message gốc → push vào list
  function submitCreate() {
    if (!formTitle.trim()) {
      notify.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!formContent.trim()) {
      notify.error('Vui lòng nhập nội dung khiếu nại');
      return;
    }

    const now = new Date().toISOString();
    const newComplaint: Complaint = {
      id: `c-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      priority: formPriority,
      status: 'pending',
      createdAt: now,
      lastActivityAt: now,
      messages: [
        {
          id: `m-${Date.now()}`,
          authorName: TEACHER_DISPLAY_NAME,
          authorRole: 'teacher',
          content: formContent.trim(),
          sentAt: now,
        },
      ],
    };

    // Push lên đầu list (newest first)
    setComplaints(prev => [newComplaint, ...prev]);

    // Chuyển sang chế độ xem khiếu nại vừa tạo
    setSelectedId(newComplaint.id);
    setRightMode('view');

    notify.success('Đã gửi khiếu nại đến Admin');
  }

  // ── Handler: chọn 1 khiếu nại để xem chi tiết ───────────────────
  function selectComplaint(c: Complaint) {
    setSelectedId(c.id);
    setRightMode('view');
    setReplyInput('');  // reset reply input khi đổi thread
  }

  // ── Handler: GV gửi reply (follow up) ────────────────────────────
  // Chỉ cho phép reply khi status là 'in_progress' hoặc 'pending'
  // (đã 'resolved'/'rejected' thì thread đã đóng)
  function sendReply() {
    if (!selectedComplaint) return;
    const content = replyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }

    const now = new Date().toISOString();
    const newMessage: ComplaintMessage = {
      id: `m-${Date.now()}`,
      authorName: TEACHER_DISPLAY_NAME,
      authorRole: 'teacher',
      content,
      sentAt: now,
    };

    setComplaints(prev => prev.map(c => {
      if (c.id !== selectedComplaint.id) return c;
      return {
        ...c,
        messages: [...c.messages, newMessage],
        lastActivityAt: now,
      };
    }));

    setReplyInput('');
    notify.success('Đã gửi tin nhắn');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Helper check: thread đã đóng hay chưa (resolved hoặc rejected)
  const isThreadClosed = selectedComplaint?.status === 'resolved'
                      || selectedComplaint?.status === 'rejected';

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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Khiếu nại</h1>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Tiêu đề + nút tạo mới */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface mb-1">Khiếu nại</h2>
              <p className="text-on-surface-variant text-sm">
                Gửi phản ánh đến Admin về thanh toán, duyệt khóa học, TK ngân hàng, lỗi hệ thống...
              </p>
            </div>
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              Tạo khiếu nại mới
            </button>
          </motion.div>

          {/* ── 3 STAT CARDS ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
          >
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Chờ xử lý</p>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-on-surface">{stats.pending}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Đang xử lý</p>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-on-surface">{stats.inProgress}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Đã đóng</p>
                <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-on-surface">{stats.resolved}</p>
            </div>
          </motion.div>

          {/* ── BỘ LỌC ────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Loại khiếu nại
                </span>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value as 'all' | ComplaintCategory)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả loại</option>
                  {(Object.keys(CATEGORY_LABELS) as ComplaintCategory[]).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Trạng thái
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | ComplaintStatus)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chờ xử lý</option>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                  <option value="rejected">Đã từ chối</option>
                </select>
              </label>
            </div>
          </div>

          {/* ── 2 PANEL: LIST + DETAIL/CREATE ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — list khiếu nại */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" />
                  Khiếu nại của tôi
                </span>
                <span className="text-sm text-on-surface-variant font-normal">
                  {filteredComplaints.length}
                </span>
              </h3>

              {filteredComplaints.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Không có khiếu nại nào khớp bộ lọc
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredComplaints.map(c => {
                    const isSelected = c.id === selectedId && rightMode === 'view';
                    return (
                      <button
                        key={c.id}
                        onClick={() => selectComplaint(c)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className={`font-bold text-sm line-clamp-2 flex-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                            {c.title}
                          </p>
                          <PriorityBadge priority={c.priority} />
                        </div>

                        <p className="text-xs text-on-surface-variant mb-2 line-clamp-1">
                          {CATEGORY_LABELS[c.category]}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-on-surface-variant flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {c.messages.length} · {formatRelativeTime(c.lastActivityAt)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — detail hoặc form tạo mới */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm"
            >
              {/* Empty state */}
              {rightMode === null && (
                <div className="text-center py-16 px-5">
                  <Megaphone className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    Chọn 1 khiếu nại bên trái để xem chi tiết,<br />
                    hoặc nhấn <span className="font-bold text-primary">Tạo khiếu nại mới</span> ở góc trên.
                  </p>
                </div>
              )}

              {/* MODE CREATE — form tạo mới */}
              {rightMode === 'create' && (
                <div className="p-5">
                  <h3 className="font-extrabold text-on-surface text-lg mb-4">Tạo khiếu nại mới</h3>

                  <div className="space-y-4">
                    {/* Loại + Mức độ (2 cột) */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Loại khiếu nại <span className="text-red-500">*</span>
                        </span>
                        <select
                          value={formCategory}
                          onChange={e => setFormCategory(e.target.value as ComplaintCategory)}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        >
                          {(Object.keys(CATEGORY_LABELS) as ComplaintCategory[]).map(cat => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Mức độ ưu tiên
                        </span>
                        <select
                          value={formPriority}
                          onChange={e => setFormPriority(e.target.value as Priority)}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        >
                          <option value="low">Thấp</option>
                          <option value="medium">Trung bình</option>
                          <option value="high">Cao</option>
                        </select>
                      </label>
                    </div>

                    {/* Tiêu đề */}
                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Tiêu đề <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        placeholder="VD: Chưa nhận được tiền kỳ tháng 4/2026"
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                      />
                    </label>

                    {/* Nội dung */}
                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Nội dung chi tiết <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        value={formContent}
                        onChange={e => setFormContent(e.target.value)}
                        placeholder="Mô tả vấn đề càng cụ thể càng tốt: kỳ nào, khóa nào, lỗi gì, đã thử cách gì..."
                        rows={6}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />
                    </label>

                    {/* Cảnh báo nhẹ về thời gian xử lý */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-on-surface-variant">
                        Admin thường phản hồi trong vòng 2 ngày làm việc. Khiếu nại ưu tiên Cao sẽ được xử lý trước.
                      </p>
                    </div>

                    {/* Nút */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/30">
                      <button
                        onClick={cancelCreate}
                        className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={submitCreate}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                      >
                        <Send className="w-4 h-4" />
                        Gửi khiếu nại
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE VIEW — detail thread */}
              {rightMode === 'view' && selectedComplaint && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedComplaint.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-outline-variant/30">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <h3 className="font-extrabold text-on-surface flex-1 min-w-0">
                          {selectedComplaint.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PriorityBadge priority={selectedComplaint.priority} />
                          <StatusBadge status={selectedComplaint.status} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {CATEGORY_LABELS[selectedComplaint.category]}
                        </span>
                        <span>·</span>
                        <span>Gửi lúc {formatDateTime(selectedComplaint.createdAt)}</span>
                      </div>
                    </div>

                    {/* Thread messages */}
                    <div className="px-5 py-4 space-y-4 max-h-[400px] overflow-y-auto">
                      {selectedComplaint.messages.map(m => (
                        <MessageBubble key={m.id} message={m} />
                      ))}
                    </div>

                    {/* Reply box hoặc thông báo đã đóng */}
                    {isThreadClosed ? (
                      <div className="px-5 py-4 border-t border-outline-variant/30 bg-surface-container/30">
                        <p className="text-sm text-on-surface-variant text-center">
                          Khiếu nại này đã được {selectedComplaint.status === 'resolved' ? 'giải quyết' : 'từ chối'}.
                          Bạn không thể gửi tin nhắn mới.
                        </p>
                      </div>
                    ) : (
                      <div className="px-5 py-4 border-t border-outline-variant/30">
                        <textarea
                          value={replyInput}
                          onChange={e => setReplyInput(e.target.value)}
                          placeholder="Bổ sung thông tin, trả lời Admin..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none mb-3"
                        />
                        <div className="flex items-center justify-end">
                          <button
                            onClick={sendReply}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                          >
                            <Send className="w-4 h-4" />
                            Gửi
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          </div>

        </main>
      </div>
    </div>
  );
}
