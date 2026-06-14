/**
 * TeacherGradesPage — Trang "Chấm điểm bài tập" cho Giáo viên (UC31)
 *
 * Mục đích:
 *   - Hiển thị toàn bộ bài tập học sinh đã nộp
 *   - GV lọc theo khóa/bài tập/trạng thái, chọn bài nộp, nhập điểm + nhận xét
 *   - Lưu kết quả → trạng thái bài chuyển sang "Đã chấm"
 *
 * Luồng chính:
 *   1. GV chọn bộ lọc ở thanh trên (khóa, bài tập, trạng thái, search tên HS)
 *   2. Danh sách bài nộp (panel trái) cập nhật theo bộ lọc
 *   3. Click 1 bài nộp → khu vực chấm (panel phải) hiển thị thông tin chi tiết
 *      và form chấm điểm
 *   4. GV nhập Điểm + Nhận xét → click "Lưu" → state cập nhật
 *   5. Có thể chấm lại bất kỳ lúc nào (kể cả khi đã chấm)
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Save, Search,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertCircle,
  Download, Paperclip, Megaphone, Database,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 3 trạng thái bài nộp:
//   - pending:  chưa chấm
//   - graded:   đã chấm xong
//   - re_submit: HS đã nộp lại sau khi GV đã chấm (cần chấm lại)
type SubmissionStatus = 'pending' | 'graded' | 'resubmit';

// File đính kèm bài nộp — hiện chỉ có metadata; URL tải thật sẽ do
// backend trả về (signed URL) khi API submissions sẵn sàng
interface SubmissionFile {
  name: string;        // Tên file gốc, vd "baitap-toan-an.pdf"
  size: string;        // Kích thước đọc được, vd "1.2 MB"
  type: 'pdf' | 'doc' | 'image' | 'other'; // Phân loại để hiển thị icon
}

// 1 bài nộp của 1 HS
interface Submission {
  id: string;
  studentName: string;
  // Avatar: không lưu URL thật, dùng ui-avatars sinh từ tên cho gọn
  studentEmail: string;

  // Liên kết đến khóa/bài tập (để lọc)
  courseId: string;
  courseTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  maxScore: number;          // Thang điểm, vd 10

  // Thời gian nộp + lần nộp thứ N (HS có thể nộp lại)
  submittedAt: string;       // ISO datetime
  attemptNumber: number;

  files: SubmissionFile[];

  // ── Thông tin chấm điểm (chỉ có khi đã chấm) ──
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
  gradedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — MẪU NHẬN XÉT NHANH
// ═══════════════════════════════════════════════════════════════════
// Đặt ở scope module vì là hằng số, không thay đổi theo render.
// Khi GV click 1 chip, text sẽ được APPEND vào feedback hiện tại.
// (Append thay vì replace để GV có thể combine nhiều mẫu.)
const QUICK_FEEDBACK_TEMPLATES = [
  'Trình bày rõ ràng, sạch đẹp.',
  'Lập luận chặt chẽ, đúng hướng.',
  'Cần xem lại cách phân tích.',
  'Sai bước cuối, em xem lại.',
  'Cố gắng luyện thêm bài tập dạng này.',
  'Xuất sắc!',
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — NAV_ITEMS (đồng bộ sidebar teacher)
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
//  PHẦN 5 — HELPER: format datetime
// ═══════════════════════════════════════════════════════════════════
// Format ISO datetime → "DD/MM/YYYY HH:mm" theo locale vi-VN
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // Dùng toLocaleString để có cả ngày và giờ
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 6 — SUB-COMPONENT: StatusBadge
// ═══════════════════════════════════════════════════════════════════
// Pill hiển thị trạng thái bài nộp với icon + màu phù hợp.
// Tách thành component vì lặp lại nhiều chỗ (list + detail).
function StatusBadge({ status }: { status: SubmissionStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chưa chấm',
      className: 'bg-amber-500/10 text-amber-600',
    },
    graded: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã chấm',
      className: 'bg-green-500/10 text-green-600',
    },
    resubmit: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: 'Cần chấm lại',
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

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 7 — SUB-COMPONENT: FileChip
// ═══════════════════════════════════════════════════════════════════
// Hiển thị 1 file đính kèm dưới dạng chip có icon + tên + size + nút tải.
// Tách component vì 1 bài có thể nhiều file → tránh duplicate.
function FileChip({ file }: { file: SubmissionFile }) {
  // Backend chưa có endpoint tải file bài nộp — thông báo cho GV biết
  // thay vì để nút bấm không phản hồi gì
  function handleDownload() {
    notify.info(`Chức năng tải file ${file.name} sẽ khả dụng khi kết nối backend`);
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant rounded-lg hover:bg-surface-container/70 transition-colors text-left max-w-full"
    >
      <Paperclip className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface truncate">{file.name}</p>
        <p className="text-xs text-on-surface-variant">{file.size}</p>
      </div>
      <Download className="w-4 h-4 text-primary flex-shrink-0" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 8 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherGradesPage() {
  // ── State chính ─────────────────────────────────────────────────
  // Khởi tạo rỗng — dữ liệu bài nộp sẽ load từ backend khi API
  // submissions/grading sẵn sàng (backend hiện chưa có endpoint này)
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Bộ lọc — 'all' = không lọc
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ID bài nộp đang chấm (null = chưa chọn)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form chấm điểm — tách khỏi submission để "Hủy" không ảnh hưởng state gốc
  // Khi mở 1 submission → copy score/feedback hiện tại vào form
  const [scoreInput, setScoreInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  // Toggle: có gửi thông báo cho HS sau khi lưu điểm không
  // Đặc thù: hữu ích vì HS không vào portal liên tục
  const [notifyStudent, setNotifyStudent] = useState<boolean>(true);

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Danh sách option duy nhất cho dropdown lọc ──────────────────
  // Dùng useMemo vì derive từ submissions, chỉ tính lại khi submissions đổi
  const courseOptions = useMemo(() => {
    // Map<courseId, courseTitle> để loại trùng
    const map = new Map<string, string>();
    submissions.forEach(s => map.set(s.courseId, s.courseTitle));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [submissions]);

  // Bài tập filter — phụ thuộc khóa đang chọn (nếu chọn khóa cụ thể)
  // Nếu chọn 'all' → hiển thị tất cả bài tập của mọi khóa
  const assignmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    submissions
      .filter(s => courseFilter === 'all' || s.courseId === courseFilter)
      .forEach(s => map.set(s.assignmentId, s.assignmentTitle));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [submissions, courseFilter]);

  // ── Danh sách đã lọc — dùng để render panel trái ────────────────
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      if (courseFilter !== 'all' && s.courseId !== courseFilter) return false;
      if (assignmentFilter !== 'all' && s.assignmentId !== assignmentFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      // Search: lowercase + contains, áp dụng cho tên HS
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (!s.studentName.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [submissions, courseFilter, assignmentFilter, statusFilter, searchTerm]);

  // Submission đang chọn — find theo selectedId
  const selectedSubmission = submissions.find(s => s.id === selectedId);

  // ── Handler: đổi khóa học (filter) ──────────────────────────────
  // Reset bài tập filter vì list bài tập phụ thuộc khóa
  function changeCourseFilter(newCourseId: string) {
    setCourseFilter(newCourseId);
    setAssignmentFilter('all');
  }

  // ── Handler: chọn 1 submission để chấm ──────────────────────────
  // Copy data hiện tại vào form (nếu đã có) để GV thấy và sửa
  function selectSubmission(submission: Submission) {
    setSelectedId(submission.id);
    setScoreInput(submission.score?.toString() ?? '');
    setFeedbackInput(submission.feedback ?? '');
  }

  // ── Handler: chèn template feedback vào ô feedback ──────────────
  // Append với dấu cách + xuống dòng để tránh dính liền text cũ
  function insertTemplate(template: string) {
    setFeedbackInput(prev => prev ? `${prev}\n${template}` : template);
  }

  // ── Handler: lưu điểm + feedback ────────────────────────────────
  // Validate:
  //   - Điểm phải là số hợp lệ
  //   - Điểm trong khoảng [0, maxScore]
  // Sau khi commit:
  //   - Cập nhật status = 'graded', gắn gradedAt = bây giờ
  //   - Notify (mock) HS nếu toggle bật
  function saveGrade() {
    if (!selectedSubmission) return;

    // Parse điểm — chấp nhận cả số nguyên và thập phân
    const score = parseFloat(scoreInput);
    if (isNaN(score)) {
      notify.error('Vui lòng nhập điểm là số');
      return;
    }
    if (score < 0 || score > selectedSubmission.maxScore) {
      notify.error(`Điểm phải từ 0 đến ${selectedSubmission.maxScore}`);
      return;
    }

    // Commit: update submission trong state
    // Dùng map để giữ immutability — tránh mutate trực tiếp
    setSubmissions(prev => prev.map(s => {
      if (s.id !== selectedSubmission.id) return s;
      return {
        ...s,
        status: 'graded',
        score,
        feedback: feedbackInput.trim() || undefined,
        gradedAt: new Date().toISOString(),
      };
    }));

    notify.success('Đã lưu điểm');
    // Gửi thông báo cho HS hiện chỉ là toast — sẽ gọi API notification
    // khi backend hỗ trợ
    if (notifyStudent) {
      notify.info(`Đã thông báo ${selectedSubmission.studentName} qua tin nhắn`);
    }
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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Chấm điểm</h1>
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

          {/* Tiêu đề */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Chấm điểm bài tập</h2>
            <p className="text-on-surface-variant text-sm">
              Lọc bài nộp theo khóa học / bài tập / trạng thái → chọn 1 bài → nhập điểm và nhận xét
            </p>
          </motion.div>

          {/* ── THANH BỘ LỌC ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

              {/* Khóa học */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Khóa học
                </span>
                <select
                  value={courseFilter}
                  onChange={e => changeCourseFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả khóa</option>
                  {courseOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.title}</option>
                  ))}
                </select>
              </label>

              {/* Bài tập (phụ thuộc khóa) */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Bài tập
                </span>
                <select
                  value={assignmentFilter}
                  onChange={e => setAssignmentFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả bài tập</option>
                  {assignmentOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.title}</option>
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
                  onChange={e => setStatusFilter(e.target.value as 'all' | SubmissionStatus)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chưa chấm</option>
                  <option value="graded">Đã chấm</option>
                  <option value="resubmit">Cần chấm lại</option>
                </select>
              </label>

              {/* Search tên HS */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Tìm tên HS
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Nhập tên..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>
              </label>
            </div>
          </motion.div>

          {/* ── 2 PANEL: DANH SÁCH + FORM CHẤM ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — Danh sách bài nộp đã lọc */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Bài nộp
                </span>
                <span className="text-sm text-on-surface-variant font-normal">
                  {filteredSubmissions.length} bài
                </span>
              </h3>

              {filteredSubmissions.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  {/* Phân biệt 2 trường hợp: chưa có dữ liệu vs lọc không ra kết quả */}
                  {submissions.length === 0
                    ? 'Chưa có bài nộp nào từ học sinh'
                    : 'Không có bài nộp nào khớp bộ lọc'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredSubmissions.map(s => {
                    const isSelected = s.id === selectedId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => selectSubmission(s)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        {/* Avatar + tên HS + status badge */}
                        <div className="flex items-start gap-3 mb-2">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.studentName)}&size=40&background=random&bold=true`}
                            alt={s.studentName}
                            className="w-9 h-9 rounded-full flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                              {s.studentName}
                            </p>
                            <p className="text-xs text-on-surface-variant line-clamp-1">
                              {s.assignmentTitle}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>

                        {/* Thông tin nộp: thời gian + lần thứ N + số file */}
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant pl-12">
                          <span>{formatDateTime(s.submittedAt)}</span>
                          {s.attemptNumber > 1 && (
                            <span className="text-amber-600 font-bold">Lần {s.attemptNumber}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {s.files.length}
                          </span>
                        </div>

                        {/* Điểm cũ nếu đã chấm */}
                        {s.status !== 'pending' && s.score !== undefined && (
                          <div className="mt-2 pl-12 text-xs">
                            <span className="text-on-surface-variant">Điểm: </span>
                            <span className="font-bold text-on-surface">{s.score}/{s.maxScore}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — Khu vực chấm điểm */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
            >
              {!selectedSubmission ? (
                <div className="text-center py-16">
                  <ClipboardList className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    Chọn 1 bài nộp ở bên trái để bắt đầu chấm
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedSubmission.id}  // re-mount khi đổi submission để animation chạy lại
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* ── Thông tin HS + bài tập ───────────── */}
                    <div className="mb-5 pb-4 border-b border-outline-variant/30">
                      <div className="flex items-start gap-3 mb-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSubmission.studentName)}&size=56&background=random&bold=true`}
                          alt={selectedSubmission.studentName}
                          className="w-12 h-12 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-on-surface">{selectedSubmission.studentName}</p>
                          <p className="text-xs text-on-surface-variant">{selectedSubmission.studentEmail}</p>
                        </div>
                        <StatusBadge status={selectedSubmission.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-bold mb-0.5">Bài tập</p>
                          <p className="text-on-surface font-semibold">{selectedSubmission.assignmentTitle}</p>
                          <p className="text-xs text-on-surface-variant">{selectedSubmission.courseTitle}</p>
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-bold mb-0.5">Nộp lúc</p>
                          <p className="text-on-surface">{formatDateTime(selectedSubmission.submittedAt)}</p>
                          {selectedSubmission.attemptNumber > 1 && (
                            <p className="text-xs text-amber-600 font-bold">
                              Lần nộp thứ {selectedSubmission.attemptNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── File bài làm ─────────────────────── */}
                    <div className="mb-5">
                      <p className="text-sm font-bold text-on-surface mb-2">
                        File bài làm ({selectedSubmission.files.length})
                      </p>
                      <div className="space-y-2">
                        {selectedSubmission.files.map((f, idx) => (
                          <FileChip key={idx} file={f} />
                        ))}
                      </div>
                    </div>

                    {/* ── Form chấm điểm ───────────────────── */}
                    <div className="space-y-4 pt-4 border-t border-outline-variant/30">
                      <p className="text-sm font-bold text-on-surface">Chấm điểm</p>

                      {/* Điểm số */}
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Điểm số <span className="text-red-500">*</span>
                          <span className="text-on-surface-variant/70 font-normal normal-case ml-2">
                            (thang điểm tối đa: {selectedSubmission.maxScore})
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={selectedSubmission.maxScore}
                            value={scoreInput}
                            onChange={e => setScoreInput(e.target.value)}
                            placeholder="0"
                            className="w-24 px-3 py-2 text-lg font-bold bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface text-center"
                          />
                          <span className="text-on-surface-variant font-bold">/ {selectedSubmission.maxScore}</span>
                        </div>
                      </label>

                      {/* Nhận xét */}
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Nhận xét / Feedback cho học sinh
                        </span>
                        <textarea
                          value={feedbackInput}
                          onChange={e => setFeedbackInput(e.target.value)}
                          placeholder="Nhận xét về bài làm, điểm cần cải thiện..."
                          rows={4}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                        />
                      </label>

                      {/* Mẫu nhận xét nhanh — click để append */}
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">
                          Mẫu nhận xét nhanh
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_FEEDBACK_TEMPLATES.map(template => (
                            <button
                              key={template}
                              onClick={() => insertTemplate(template)}
                              className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-medium transition-colors"
                            >
                              + {template}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Toggle: thông báo HS */}
                      <label className="flex items-center gap-3 cursor-pointer pt-2">
                        <input
                          type="checkbox"
                          checked={notifyStudent}
                          onChange={e => setNotifyStudent(e.target.checked)}
                          className="w-5 h-5 accent-primary"
                        />
                        <span className="text-sm text-on-surface">
                          Gửi thông báo cho học sinh sau khi lưu điểm
                        </span>
                      </label>
                    </div>

                    {/* Nút Lưu */}
                    <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-outline-variant/30">
                      {/* Hiển thị thời điểm chấm trước nếu đã chấm */}
                      {selectedSubmission.gradedAt && (
                        <p className="text-xs text-on-surface-variant mr-auto">
                          Đã chấm lần cuối: {formatDateTime(selectedSubmission.gradedAt)}
                        </p>
                      )}
                      <button
                        onClick={saveGrade}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                      >
                        <Save className="w-4 h-4" />
                        {selectedSubmission.status === 'pending' ? 'Lưu & Hoàn thành' : 'Cập nhật điểm'}
                      </button>
                    </div>
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
