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

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import {
  addStudentComplaintMessage,
  createStudentComplaint,
  listStudentComplaints,
  PRIORITY_LABELS,
  type ComplaintCategory,
  type ComplaintPriority,
  type ComplaintStatus,
  type ComplaintDetail,
  type ComplaintMessage,
} from '../../api/complaintService';
import {
  Send, Plus, CheckCircle2, Clock, XCircle,
  Megaphone, MessageSquare, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { AttachmentPicker, MessageAttachments } from '../../components/complaints/ComplaintAttachments';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES (dùng từ complaintService — nguồn sự thật chung)
// ═══════════════════════════════════════════════════════════════════

type Priority = ComplaintPriority;
type Complaint = ComplaintDetail;

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — CONSTANTS (student-specific labels cho subset categories)
// ═══════════════════════════════════════════════════════════════════

// Subset categories phù hợp với học sinh — labels tiếng Việt riêng
type StudentCategory = Extract<ComplaintCategory,
  'course_content' | 'teacher' | 'payment' | 'grading' | 'parent_link' | 'technical' | 'other'
>;

const STUDENT_CATEGORY_LABELS: Record<StudentCategory, string> = {
  course_content: 'Nội dung khóa học',
  teacher:        'Giáo viên',
  payment:        'Thanh toán',
  grading:        'Chấm điểm / Quiz',
  parent_link:    'Liên kết phụ huynh',
  technical:      'Lỗi kỹ thuật',
  other:          'Khác',
};

const STUDENT_DISPLAY_NAME = 'Học viên Bee';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — HELPERS
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
          <MessageAttachments attachments={message.attachments} />
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
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<'all' | ComplaintCategory>('all');
  const [statusFilter,   setStatusFilter]   = useState<'all' | ComplaintStatus>('all');

  // Mode panel phải: 'view' xem chi tiết | 'create' form mới | null empty
  const [rightMode, setRightMode] = useState<'view' | 'create' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form tạo mới — local state để Hủy không ảnh hưởng dữ liệu
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<StudentCategory>('other');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formContent, setFormContent] = useState<string>('');
  const [formFiles, setFormFiles] = useState<File[]>([]);

  const [replyInput, setReplyInput] = useState<string>('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);

  const user = useAuthStore(state => state.user);
  const displayName = user?.name ?? STUDENT_DISPLAY_NAME;

  useEffect(() => {
    let cancelled = false;

    async function loadComplaints() {
      setIsLoading(true);
      try {
        const data = await listStudentComplaints();
        if (!cancelled) {
          setComplaints(data);
        }
      } catch (error) {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : 'Khong the tai danh sach khieu nai');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadComplaints();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setFormFiles([]);
    setRightMode('create');
    setSelectedId(null);
  }

  function cancelCreate() {
    setRightMode(null);
  }

  async function submitCreate() {
    if (!formTitle.trim()) {
      notify.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!formContent.trim()) {
      notify.error('Vui lòng nhập nội dung khiếu nại');
      return;
    }

    setIsSubmitting(true);
    try {
      const newComplaint = await createStudentComplaint({
        title: formTitle.trim(),
        category: formCategory,
        priority: formPriority,
        content: formContent.trim(),
      }, formFiles);

      setComplaints(prev => [newComplaint, ...prev.filter(c => c.id !== newComplaint.id)]);
      setSelectedId(newComplaint.id);
      setRightMode('view');
      setFormTitle('');
      setFormContent('');
      setFormFiles([]);
      notify.success('Đã gửi khiếu nại đến Admin');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể gửi khiếu nại');
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectComplaint(c: Complaint) {
    setSelectedId(c.id);
    setRightMode('view');
    setReplyInput('');
    setReplyFiles([]);
  }

  // HS gửi reply (follow up). Thread đã đóng vẫn gửi được → tự mở lại.
  async function sendReply() {
    if (!selectedComplaint) return;
    const content = replyInput.trim();
    if (!content && replyFiles.length === 0) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedComplaint = await addStudentComplaintMessage(selectedComplaint.id, content, replyFiles);
      setComplaints(prev => prev.map(c =>
        c.id === updatedComplaint.id ? updatedComplaint : c
      ));
      setReplyInput('');
      setReplyFiles([]);
      notify.success('Đã gửi tin nhắn');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể gửi tin nhắn');
    } finally {
      setIsSubmitting(false);
    }
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
                {(Object.keys(STUDENT_CATEGORY_LABELS) as StudentCategory[]).map(cat => (
                  <option key={cat} value={cat}>{STUDENT_CATEGORY_LABELS[cat]}</option>
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

            {isLoading ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                Dang tai danh sach khieu nai...
              </p>
            ) : filteredComplaints.length === 0 ? (
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
                        {STUDENT_CATEGORY_LABELS[c.category]}
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
                        onChange={e => setFormCategory(e.target.value as StudentCategory)}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                      >
                        {(Object.keys(STUDENT_CATEGORY_LABELS) as StudentCategory[]).map(cat => (
                          <option key={cat} value={cat}>{STUDENT_CATEGORY_LABELS[cat]}</option>
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

                  {/* File đính kèm (ảnh/PDF evidence) */}
                  <AttachmentPicker files={formFiles} onChange={setFormFiles} disabled={isSubmitting} />

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
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
                        {STUDENT_CATEGORY_LABELS[selectedComplaint.category]}
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

                  {/* Reply box — thread đã đóng vẫn cho gửi (sẽ tự mở lại) */}
                  <div className="px-5 py-4 border-t border-outline-variant/30">
                    {isThreadClosed && (
                      <div className="mb-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-on-surface-variant">
                          Khiếu nại đã {selectedComplaint.status === 'resolved' ? 'được giải quyết' : 'bị từ chối'}.
                          Nếu chưa thỏa đáng, bạn có thể gửi phản hồi để <span className="font-bold">mở lại</span> khiếu nại.
                        </p>
                      </div>
                    )}
                    <textarea
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder={isThreadClosed ? 'Nêu lý do mở lại / bổ sung thông tin...' : 'Bổ sung thông tin, trả lời Admin...'}
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none mb-3"
                    />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <AttachmentPicker files={replyFiles} onChange={setReplyFiles} disabled={isSubmitting} />
                      <button
                        onClick={sendReply}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        {isThreadClosed ? 'Gửi & mở lại' : 'Gửi'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
