/**
 * ComplaintsPage (Student) — Trang "Gửi khiếu nại cho Admin" (UC11 v6.5)
 *
 * Bối cảnh:
 *   - UC11 v6.5: HS/PH gửi khiếu nại đến Admin (thay cho hoàn tiền)
 *   - Admin xử lý qua UC38
 *   - Các loại khiếu nại phù hợp với học sinh:
 *       + Nội dung khóa học (video lỗi, sai kiến thức, thiếu tài liệu)
 *       + Giáo viên (trả lời chậm, thái độ chưa phù hợp, chấm điểm sai)
 *       + Thanh toán (bị trừ tiền nhưng chưa truy cập được khóa học)
 *       + Bài kiểm tra / Quiz (lỗi điểm, không mở được, đề bài sai)
 *       + Liên kết phụ huynh (lời mời lạ, không gỡ được liên kết)
 *       + Lỗi kỹ thuật (video lag, không xem được trên mobile, lỗi đăng nhập)
 *
 * Layout:
 *   - Khác trang Teacher: dùng DashboardHeader + PageBanner (layout HS),
 *     không có sidebar cố định trên trang (sidebar nằm trong avatar dropdown)
 *
 * Cơ chế thread:
 *   - HS gửi → tạo thread với message gốc, status = pending
 *   - Admin reply → thêm message, status → in_progress
 *   - Admin/HS follow up → tiếp tục thread
 *   - Admin đánh dấu resolved/rejected → đóng thread (HS không gửi thêm được)
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import {
  Send, Plus, CheckCircle2, Clock, XCircle,
  Megaphone, MessageSquare, AlertCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 7 loại khiếu nại — phù hợp role học sinh
type ComplaintCategory =
  | 'course_content' // Nội dung khóa học (video lỗi, sai kiến thức)
  | 'teacher'        // Giáo viên (thái độ, trả lời chậm)
  | 'payment'        // Thanh toán (trừ tiền 2 lần, không truy cập được)
  | 'grading'        // Chấm điểm / Quiz / Bài kiểm tra
  | 'parent_link'    // Liên kết phụ huynh (UC47-49)
  | 'technical'      // Lỗi kỹ thuật / hỗ trợ
  | 'other';

// Mức độ ưu tiên — HS chọn khi gửi
type Priority = 'low' | 'medium' | 'high';

// 4 trạng thái xử lý
type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

interface ComplaintMessage {
  id: string;
  authorName: string;
  authorRole: 'student' | 'admin';
  content: string;
  sentAt: string;
}

interface Complaint {
  id: string;
  title: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  // messages[0] là nội dung gốc của HS
  messages: ComplaintMessage[];
  createdAt: string;
  lastActivityAt: string;
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  course_content: 'Nội dung khóa học',
  teacher:        'Giáo viên',
  payment:        'Thanh toán',
  grading:        'Chấm điểm / Quiz',
  parent_link:    'Liên kết phụ huynh',
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

const STUDENT_DISPLAY_NAME = 'Học viên Bee';

const INITIAL_COMPLAINTS: Complaint[] = [
  // Khiếu nại đang chờ Admin xem — thanh toán (mức độ cao)
  {
    id: 'sc1',
    title: 'Đã thanh toán nhưng chưa truy cập được khóa học',
    category: 'payment',
    priority: 'high',
    status: 'pending',
    createdAt: '2026-05-20T08:30:00',
    lastActivityAt: '2026-05-20T08:30:00',
    messages: [
      {
        id: 'sm1',
        authorName: STUDENT_DISPLAY_NAME, authorRole: 'student',
        content: 'Em đã thanh toán khóa "Toán nâng cao lớp 8" qua MoMo lúc 7:50 sáng nay, ngân hàng báo trừ tiền thành công nhưng đến giờ vào mục Khóa học vẫn chưa thấy. Mã giao dịch: MM20260520075012345.',
        sentAt: '2026-05-20T08:30:00',
      },
    ],
  },
  // Khiếu nại Admin đang xử lý — nội dung khóa học
  {
    id: 'sc2',
    title: 'Video chương 3 khóa Tiếng Anh lớp 9 bị mất tiếng',
    category: 'course_content',
    priority: 'medium',
    status: 'in_progress',
    createdAt: '2026-05-17T20:15:00',
    lastActivityAt: '2026-05-18T09:40:00',
    messages: [
      {
        id: 'sm2a',
        authorName: STUDENT_DISPLAY_NAME, authorRole: 'student',
        content: 'Em xem video "Bài 3 — Thì hiện tại hoàn thành" trong khóa Tiếng Anh lớp 9 thì âm thanh chỉ phát được khoảng 30 giây đầu rồi tắt hẳn, dù phụ đề vẫn chạy bình thường. Đã thử trình duyệt Chrome và Edge đều bị.',
        sentAt: '2026-05-17T20:15:00',
      },
      {
        id: 'sm2b',
        authorName: 'Admin Trần Hữu Phước', authorRole: 'admin',
        content: 'Cảm ơn em đã báo lỗi. Chúng tôi đã thông báo cho giáo viên để re-upload video. Dự kiến hoàn tất trong 1-2 ngày làm việc. Em có thể tạm học các chương khác trong khi chờ.',
        sentAt: '2026-05-18T09:40:00',
      },
    ],
  },
  // Khiếu nại đã được giải quyết — chấm điểm
  {
    id: 'sc3',
    title: 'Điểm quiz chương 2 hiển thị sai (8/10 nhưng em làm đúng 9 câu)',
    category: 'grading',
    priority: 'medium',
    status: 'resolved',
    createdAt: '2026-05-12T16:00:00',
    lastActivityAt: '2026-05-13T11:30:00',
    messages: [
      {
        id: 'sm3a',
        authorName: STUDENT_DISPLAY_NAME, authorRole: 'student',
        content: 'Em làm quiz chương 2 môn Lý lớp 8, kiểm tra lại đáp án thấy đúng 9/10 nhưng hệ thống chỉ tính 8/10. Câu số 7 đáp án đúng là B nhưng hệ thống báo em chọn sai.',
        sentAt: '2026-05-12T16:00:00',
      },
      {
        id: 'sm3b',
        authorName: 'Admin Lê Thị Mai', authorRole: 'admin',
        content: 'Đã rà soát: câu 7 có lỗi trong key đáp án (đáp án đúng là B đúng như em phản ánh). Đã cập nhật lại điểm thành 9/10 và sửa lỗi cho các bạn HS khác làm bài này. Cảm ơn em rất nhiều!',
        sentAt: '2026-05-13T11:30:00',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Thời gian tương đối — dùng cho list (giống pattern của TeacherComplaints)
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
//  PHẦN 5 — SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

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

// Bubble tin nhắn — HS trái (teal), Admin phải (đỏ)
function MessageBubble({ message }: { message: ComplaintMessage }) {
  const isAdmin = message.authorRole === 'admin';
  return (
    <div className={`flex gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
      <img
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.authorName)}&size=36&background=${isAdmin ? 'ef4444' : '14b8a6'}&color=fff&bold=true`}
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
            : 'bg-teal-500/10 text-on-surface rounded-tl-sm border border-teal-500/20'
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 6 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ComplaintsPage() {
  // ── State chính ─────────────────────────────────────────────────
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);

  const [categoryFilter, setCategoryFilter] = useState<'all' | ComplaintCategory>('all');
  const [statusFilter,   setStatusFilter]   = useState<'all' | ComplaintStatus>('all');

  // Mode panel phải: 'view' xem chi tiết | 'create' form mới | null empty
  const [rightMode, setRightMode] = useState<'view' | 'create' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form tạo mới — local state để Hủy không ảnh hưởng dữ liệu
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ComplaintCategory>('other');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formContent, setFormContent] = useState<string>('');

  const [replyInput, setReplyInput] = useState<string>('');

  const user = useAuthStore(state => state.user);
  const displayName = user?.name ?? STUDENT_DISPLAY_NAME;

  // ── DERIVED: stats cho 3 cards ──────────────────────────────────
  const stats = useMemo(() => ({
    pending:    complaints.filter(c => c.status === 'pending').length,
    inProgress: complaints.filter(c => c.status === 'in_progress').length,
    resolved:   complaints.filter(c => c.status === 'resolved' || c.status === 'rejected').length,
  }), [complaints]);

  // ── DERIVED: list đã lọc, sort theo lastActivityAt DESC ─────────
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter(c => {
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        if (statusFilter   !== 'all' && c.status   !== statusFilter)   return false;
        return true;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [complaints, categoryFilter, statusFilter]);

  const selectedComplaint = complaints.find(c => c.id === selectedId);

  function openCreateForm() {
    setFormTitle('');
    setFormCategory('other');
    setFormPriority('medium');
    setFormContent('');
    setRightMode('create');
    setSelectedId(null);
  }

  function cancelCreate() {
    setRightMode(null);
  }

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
      id: `sc-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      priority: formPriority,
      status: 'pending',
      createdAt: now,
      lastActivityAt: now,
      messages: [
        {
          id: `sm-${Date.now()}`,
          authorName: displayName,
          authorRole: 'student',
          content: formContent.trim(),
          sentAt: now,
        },
      ],
    };

    setComplaints(prev => [newComplaint, ...prev]);
    setSelectedId(newComplaint.id);
    setRightMode('view');
    notify.success('Đã gửi khiếu nại đến Admin');
  }

  function selectComplaint(c: Complaint) {
    setSelectedId(c.id);
    setRightMode('view');
    setReplyInput('');
  }

  // HS gửi reply (follow up). Chỉ cho phép khi pending/in_progress.
  function sendReply() {
    if (!selectedComplaint) return;
    const content = replyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }

    const now = new Date().toISOString();
    const newMessage: ComplaintMessage = {
      id: `sm-${Date.now()}`,
      authorName: displayName,
      authorRole: 'student',
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

  const isThreadClosed = selectedComplaint?.status === 'resolved'
                      || selectedComplaint?.status === 'rejected';

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Khiếu nại"
        subtitle="Gửi phản ánh đến Admin về khóa học, giáo viên, thanh toán, lỗi kỹ thuật..."
      />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">

        {/* Tiêu đề + nút tạo mới */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start justify-between gap-3 flex-wrap"
        >
          <div>
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Khiếu nại của tôi</h2>
            <p className="text-on-surface-variant text-sm">
              Admin sẽ phản hồi trong vòng 2 ngày làm việc.
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
                Danh sách khiếu nại
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
                      placeholder="VD: Đã thanh toán nhưng chưa truy cập được khóa học"
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
                      placeholder="Mô tả vấn đề càng cụ thể càng tốt: khóa nào, chương nào, mã giao dịch, lỗi gì, đã thử cách gì..."
                      rows={6}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                    />
                  </label>

                  {/* Cảnh báo nhẹ */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-on-surface-variant">
                      Admin thường phản hồi trong vòng 2 ngày làm việc. Khiếu nại ưu tiên Cao sẽ được xử lý trước.
                      Cung cấp đầy đủ thông tin (mã giao dịch, tên khóa học, ảnh chụp màn hình nếu có) để được hỗ trợ nhanh.
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

      </div>
    </div>
  );
}
