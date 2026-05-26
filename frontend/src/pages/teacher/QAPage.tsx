/**
 * TeacherQAPage — Trang "Hỏi & Đáp" cho Giáo viên (UC32)
 *
 * Mô hình: Threaded conversation
 *   - Mỗi câu hỏi của HS là gốc của 1 thread (cuộc hội thoại)
 *   - GV trả lời → thêm message vào thread
 *   - HS có thể hỏi follow-up → tiếp tục thread
 *   - Khi xong → GV đánh dấu "Đã giải quyết" để đóng thread
 *
 * Trạng thái thread:
 *   - pending:   chưa có message nào từ GV (HS đang chờ)
 *   - answered:  GV đã reply ít nhất 1 lần, có thể còn tiếp diễn
 *   - resolved:  đã đóng — không cần theo dõi nữa
 *
 * Luồng chính:
 *   1. GV xem danh sách thread bên trái, có filter (khóa, trạng thái, search)
 *   2. Click 1 thread → panel phải hiện toàn bộ tin nhắn của thread đó
 *   3. GV gõ nội dung trả lời + (tùy chọn) click mẫu nhanh
 *   4. Click "Gửi" → message GV được thêm vào thread, status chuyển 'answered'
 *   5. Khi câu hỏi đã được giải quyết → click "Đánh dấu đã giải quyết"
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Send, Search,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, MessageSquare,
  CheckCheck, ExternalLink, Megaphone,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 3 trạng thái thread (đã giải thích ở block comment trên)
type ThreadStatus = 'pending' | 'answered' | 'resolved';

// 1 tin nhắn trong thread — có thể từ HS hoặc từ GV
interface Message {
  id: string;
  authorName: string;
  authorRole: 'student' | 'teacher';
  content: string;
  sentAt: string;  // ISO datetime
}

// 1 thread câu hỏi
interface QuestionThread {
  id: string;

  // Người hỏi (HS)
  studentName: string;
  studentEmail: string;

  // Tham chiếu khóa/bài giảng — để GV biết câu hỏi thuộc đâu
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;

  // Danh sách tin nhắn, sắp xếp tăng dần theo sentAt
  // Phần tử [0] luôn là câu hỏi gốc của HS
  messages: Message[];

  // Trạng thái + timestamp cho sorting & filtering
  status: ThreadStatus;
  createdAt: string;
  lastActivityAt: string;  // cập nhật khi có message mới
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════
// 5 thread với các trạng thái khác nhau để demo
const INITIAL_THREADS: QuestionThread[] = [
  {
    id: 't1',
    studentName: 'Nguyễn Văn An',
    studentEmail: 'an.nguyen@beeacademy.vn',
    courseId: 'c1', courseTitle: 'Toán Đại Số - Lớp 8',
    lessonId: 'l1', lessonTitle: 'Bài 1: Bình phương của một tổng',
    messages: [
      {
        id: 'm1', authorName: 'Nguyễn Văn An', authorRole: 'student',
        content: 'Thầy ơi, em chưa hiểu tại sao (a+b)² = a² + 2ab + b². Vế phải có 2ab là từ đâu vậy ạ?',
        sentAt: '2026-05-21T08:30:00',
      },
    ],
    status: 'pending',
    createdAt: '2026-05-21T08:30:00',
    lastActivityAt: '2026-05-21T08:30:00',
  },
  {
    id: 't2',
    studentName: 'Trần Thị Bích',
    studentEmail: 'bich.tran@beeacademy.vn',
    courseId: 'c1', courseTitle: 'Toán Đại Số - Lớp 8',
    lessonId: 'l2', lessonTitle: 'Bài 2: Hiệu hai bình phương',
    messages: [
      {
        id: 'm2a', authorName: 'Trần Thị Bích', authorRole: 'student',
        content: 'Thầy ơi, bài tập 3 trang 5 em làm thế này có đúng không ạ? x² - 9 = (x-3)(x+3)',
        sentAt: '2026-05-20T14:00:00',
      },
      {
        id: 'm2b', authorName: 'Giáo viên Bee', authorRole: 'teacher',
        content: 'Đúng rồi em. Đây là áp dụng hằng đẳng thức a² - b² = (a-b)(a+b) với a=x, b=3.',
        sentAt: '2026-05-20T15:30:00',
      },
      {
        id: 'm2c', authorName: 'Trần Thị Bích', authorRole: 'student',
        content: 'Vậy còn 4x² - 25 thì em làm như thế nào ạ? Vì 4 không phải bình phương đúng không thầy?',
        sentAt: '2026-05-20T16:00:00',
      },
    ],
    status: 'answered',
    createdAt: '2026-05-20T14:00:00',
    lastActivityAt: '2026-05-20T16:00:00',
  },
  {
    id: 't3',
    studentName: 'Lê Minh Cường',
    studentEmail: 'cuong.le@beeacademy.vn',
    courseId: 'c1', courseTitle: 'Toán Đại Số - Lớp 8',
    lessonId: 'l3', lessonTitle: 'Bài 3: Phân tích đa thức thành nhân tử',
    messages: [
      {
        id: 'm3a', authorName: 'Lê Minh Cường', authorRole: 'student',
        content: 'Em phân tích x² - 5x + 6 không ra. Thầy giúp em với ạ.',
        sentAt: '2026-05-19T20:00:00',
      },
      {
        id: 'm3b', authorName: 'Giáo viên Bee', authorRole: 'teacher',
        content: 'Em tìm 2 số có tích bằng 6 và tổng bằng -5. Đó là -2 và -3. Vậy x² - 5x + 6 = (x-2)(x-3). Em xem lại video bài 3 phút 7:30.',
        sentAt: '2026-05-19T21:15:00',
      },
      {
        id: 'm3c', authorName: 'Lê Minh Cường', authorRole: 'student',
        content: 'Em đã hiểu rồi ạ. Cảm ơn thầy!',
        sentAt: '2026-05-19T22:00:00',
      },
    ],
    status: 'resolved',
    createdAt: '2026-05-19T20:00:00',
    lastActivityAt: '2026-05-19T22:00:00',
  },
  {
    id: 't4',
    studentName: 'Phạm Thị Dung',
    studentEmail: 'dung.pham@beeacademy.vn',
    courseId: 'c2', courseTitle: 'Vật Lý - Lớp 9',
    lessonId: 'l4', lessonTitle: 'Định luật Ohm',
    messages: [
      {
        id: 'm4', authorName: 'Phạm Thị Dung', authorRole: 'student',
        content: 'Thầy ơi cho em hỏi: nếu mắc song song 2 điện trở R1=4Ω và R2=6Ω thì điện trở tương đương là bao nhiêu?',
        sentAt: '2026-05-21T07:00:00',
      },
    ],
    status: 'pending',
    createdAt: '2026-05-21T07:00:00',
    lastActivityAt: '2026-05-21T07:00:00',
  },
  {
    id: 't5',
    studentName: 'Hoàng Quốc Đạt',
    studentEmail: 'dat.hoang@beeacademy.vn',
    courseId: 'c1', courseTitle: 'Toán Đại Số - Lớp 8',
    lessonId: 'l1', lessonTitle: 'Bài 1: Bình phương của một tổng',
    messages: [
      {
        id: 'm5a', authorName: 'Hoàng Quốc Đạt', authorRole: 'student',
        content: 'Bài tập tự luyện số 5 đáp án là gì vậy thầy?',
        sentAt: '2026-05-20T10:00:00',
      },
      {
        id: 'm5b', authorName: 'Giáo viên Bee', authorRole: 'teacher',
        content: 'Em làm thử trước, nếu vướng chỗ nào hãy gửi cụ thể để thầy hướng dẫn nhé.',
        sentAt: '2026-05-20T11:00:00',
      },
    ],
    status: 'answered',
    createdAt: '2026-05-20T10:00:00',
    lastActivityAt: '2026-05-20T11:00:00',
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — MẪU TRẢ LỜI NHANH
// ═══════════════════════════════════════════════════════════════════
// Constant ở scope module — không thay đổi theo render.
// Click chip → APPEND vào ô trả lời (không replace).
const QUICK_REPLY_TEMPLATES = [
  'Em xem lại ví dụ trong video bài giảng nhé.',
  'Đây là bước em sai, em cần áp dụng công thức...',
  'Em có thể tham khảo thêm tài liệu PDF trong chương này.',
  'Em làm thử trước, nếu vướng chỗ nào hãy gửi cụ thể cho thầy nhé.',
  'Câu hỏi rất hay! Thầy bổ sung thêm thông tin:',
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — NAV_ITEMS (đồng bộ sidebar teacher)
// ═══════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — HELPER: format thời gian tương đối
// ═══════════════════════════════════════════════════════════════════
/**
 * formatRelativeTime — Hiển thị thời gian dạng "X phút trước".
 * Lý do dùng relative time thay vì absolute: phù hợp UX chat/Q&A,
 * GV dễ nắm "câu hỏi này đã chờ bao lâu rồi".
 *
 * Quy ước:
 *   - < 1 phút  → "Vừa xong"
 *   - < 60 phút → "X phút trước"
 *   - < 24 giờ  → "X giờ trước"
 *   - < 7 ngày  → "X ngày trước"
 *   - còn lại   → format absolute "DD/MM/YYYY"
 *
 * NOTE: dùng `now = Date.now()` mỗi lần gọi để có thời gian hiện tại.
 * Không cache trong state vì giá trị này không cần realtime — render mới
 * khi user tương tác là đủ.
 */
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
  // Quá 7 ngày → hiển thị ngày cụ thể
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Format absolute datetime — dùng cho header thread khi cần chi tiết
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 6 — SUB-COMPONENT: StatusBadge
// ═══════════════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: ThreadStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chưa trả lời',
      className: 'bg-amber-500/10 text-amber-600',
    },
    answered: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã trả lời',
      className: 'bg-blue-500/10 text-blue-600',
    },
    resolved: {
      icon: <CheckCheck className="w-3.5 h-3.5" />,
      label: 'Đã giải quyết',
      className: 'bg-green-500/10 text-green-600',
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
//  PHẦN 7 — SUB-COMPONENT: MessageBubble
// ═══════════════════════════════════════════════════════════════════
/**
 * MessageBubble — Bong bóng tin nhắn, layout khác nhau theo role:
 *   - student: căn TRÁI, nền surface-container
 *   - teacher: căn PHẢI, nền primary nhạt
 *
 * Pattern giống chat thông thường (Messenger, Zalo).
 * Tách component vì lặp lại theo số message trong thread.
 */
function MessageBubble({ message }: { message: Message }) {
  const isTeacher = message.authorRole === 'teacher';

  return (
    <div className={`flex gap-2 ${isTeacher ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <img
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.authorName)}&size=36&background=${isTeacher ? '7c3aed' : 'random'}&color=fff&bold=true`}
        alt={message.authorName}
        className="w-8 h-8 rounded-full flex-shrink-0"
      />

      {/* Bubble + meta */}
      <div className={`flex flex-col max-w-[75%] ${isTeacher ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-on-surface">{message.authorName}</span>
          <span className="text-xs text-on-surface-variant">{formatRelativeTime(message.sentAt)}</span>
        </div>
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
          isTeacher
            ? 'bg-primary text-on-primary rounded-tr-sm'
            : 'bg-surface-container text-on-surface rounded-tl-sm'
        }`}>
          {/* whitespace-pre-wrap để giữ line break từ GV gõ */}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 8 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherQAPage() {
  // ── State chính ─────────────────────────────────────────────────
  const [threads, setThreads] = useState<QuestionThread[]>(INITIAL_THREADS);

  // Bộ lọc — 'all' = không lọc
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ThreadStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ID thread đang xem (null = chưa chọn)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Nội dung trả lời đang gõ — reset sau khi gửi
  const [replyInput, setReplyInput] = useState<string>('');

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Option duy nhất cho dropdown khóa học ───────────────────────
  // Dùng useMemo vì derive từ threads, chỉ tính lại khi threads thay đổi
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    threads.forEach(t => map.set(t.courseId, t.courseTitle));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [threads]);

  // ── Danh sách thread đã lọc + sắp xếp ───────────────────────────
  // Sort theo lastActivityAt DESC để thread mới nhất lên đầu — UX chuẩn chat
  const filteredThreads = useMemo(() => {
    return threads
      .filter(t => {
        if (courseFilter !== 'all' && t.courseId !== courseFilter) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        // Search: lowercase + contains, áp dụng cho nội dung tin nhắn ĐẦU TIÊN (câu hỏi gốc)
        // và tên HS — giúp tìm cả theo người và theo nội dung
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchName = t.studentName.toLowerCase().includes(term);
          const matchContent = t.messages[0].content.toLowerCase().includes(term);
          if (!matchName && !matchContent) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [threads, courseFilter, statusFilter, searchTerm]);

  const selectedThread = threads.find(t => t.id === selectedId);

  // ── Handler: chọn thread ────────────────────────────────────────
  function selectThread(thread: QuestionThread) {
    setSelectedId(thread.id);
    // Reset reply input khi chuyển thread để tránh nhầm input cũ với thread mới
    setReplyInput('');
  }

  // ── Handler: chèn template trả lời nhanh ────────────────────────
  // Append với newline để dễ kết hợp nhiều template
  function insertTemplate(template: string) {
    setReplyInput(prev => prev ? `${prev}\n${template}` : template);
  }

  // ── Handler: gửi trả lời ────────────────────────────────────────
  // Logic:
  //   1. Validate content không rỗng
  //   2. Tạo message mới với role='teacher'
  //   3. Append vào thread.messages
  //   4. Cập nhật status:
  //      - Nếu thread đang 'pending' → 'answered'
  //      - Nếu đã 'resolved' → giữ nguyên (GV vẫn có thể nói thêm)
  //   5. Cập nhật lastActivityAt = now
  //   6. Reset replyInput
  function sendReply() {
    if (!selectedThread) return;
    const content = replyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }

    const now = new Date().toISOString();
    const newMessage: Message = {
      id: `m-${Date.now()}`,
      authorName: user?.name ?? 'Giáo viên Bee',
      authorRole: 'teacher',
      content,
      sentAt: now,
    };

    setThreads(prev => prev.map(t => {
      if (t.id !== selectedThread.id) return t;
      return {
        ...t,
        messages: [...t.messages, newMessage],
        // Chỉ chuyển 'pending' → 'answered'. Các trạng thái khác giữ nguyên.
        status: t.status === 'pending' ? 'answered' : t.status,
        lastActivityAt: now,
      };
    }));

    setReplyInput('');
    notify.success('Đã gửi trả lời');
  }

  // ── Handler: đánh dấu giải quyết / mở lại ──────────────────────
  // Toggle giữa 'resolved' và 'answered'.
  // Không cho phép chuyển trực tiếp từ 'pending' → 'resolved' (vì chưa trả lời).
  function toggleResolved() {
    if (!selectedThread) return;
    if (selectedThread.status === 'pending') {
      notify.error('Vui lòng trả lời câu hỏi trước khi đánh dấu giải quyết');
      return;
    }
    const newStatus: ThreadStatus = selectedThread.status === 'resolved' ? 'answered' : 'resolved';
    setThreads(prev => prev.map(t =>
      t.id === selectedThread.id ? { ...t, status: newStatus } : t
    ));
    notify.success(newStatus === 'resolved' ? 'Đã đánh dấu giải quyết' : 'Đã mở lại câu hỏi');
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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Hỏi & Đáp</h1>
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
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Hỏi & Đáp với học sinh</h2>
            <p className="text-on-surface-variant text-sm">
              Trả lời câu hỏi của HS theo từng cuộc hội thoại. Đánh dấu "Đã giải quyết" khi xong.
            </p>
          </motion.div>

          {/* ── THANH BỘ LỌC ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6"
          >
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

              {/* Trạng thái */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Trạng thái
                </span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | ThreadStatus)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chưa trả lời</option>
                  <option value="answered">Đã trả lời</option>
                  <option value="resolved">Đã giải quyết</option>
                </select>
              </label>

              {/* Search */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Tìm theo HS hoặc nội dung
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Nhập tên hoặc từ khóa..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>
              </label>
            </div>
          </motion.div>

          {/* ── 2 PANEL: DANH SÁCH + THREAD DETAIL ───────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — Danh sách thread */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Câu hỏi
                </span>
                <span className="text-sm text-on-surface-variant font-normal">
                  {filteredThreads.length}
                </span>
              </h3>

              {filteredThreads.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Không có câu hỏi nào khớp bộ lọc
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredThreads.map(t => {
                    const isSelected = t.id === selectedId;
                    // Preview = câu hỏi gốc của HS (message[0])
                    const firstMessage = t.messages[0];

                    return (
                      <button
                        key={t.id}
                        onClick={() => selectThread(t)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        {/* Avatar + tên + badge */}
                        <div className="flex items-start gap-2 mb-2">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(t.studentName)}&size=36&background=random&bold=true`}
                            alt={t.studentName}
                            className="w-8 h-8 rounded-full flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                              {t.studentName}
                            </p>
                            <p className="text-xs text-on-surface-variant line-clamp-1">
                              {t.lessonTitle}
                            </p>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>

                        {/* Preview câu hỏi gốc */}
                        <p className="text-sm text-on-surface line-clamp-2 mb-2 pl-10">
                          {firstMessage.content}
                        </p>

                        {/* Meta: số message, thời gian */}
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant pl-10">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {t.messages.length}
                          </span>
                          <span>{formatRelativeTime(t.lastActivityAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — Thread detail + reply box */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm flex flex-col"
            >
              {!selectedThread ? (
                <div className="text-center py-16 px-5">
                  <MessageSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    Chọn 1 câu hỏi ở bên trái để xem & trả lời
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedThread.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col"
                  >
                    {/* ── Header thread: thông tin context ───── */}
                    <div className="px-5 py-4 border-b border-outline-variant/30">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-on-surface">{selectedThread.studentName}</p>
                          <p className="text-xs text-on-surface-variant">{selectedThread.studentEmail}</p>
                        </div>
                        <StatusBadge status={selectedThread.status} />
                      </div>

                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-on-surface-variant">Câu hỏi về:</span>
                        {/* Link đến bài giảng — cho GV mở xem lại context */}
                        <Link
                          to={`/teacher/content`}
                          className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          {selectedThread.lessonTitle}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <span className="text-xs text-on-surface-variant">·</span>
                        <span className="text-xs text-on-surface-variant">{selectedThread.courseTitle}</span>
                      </div>

                      <p className="text-xs text-on-surface-variant mt-1">
                        Bắt đầu: {formatDateTime(selectedThread.createdAt)}
                      </p>
                    </div>

                    {/* ── Danh sách tin nhắn trong thread ────── */}
                    <div className="px-5 py-4 space-y-4 max-h-[400px] overflow-y-auto">
                      {selectedThread.messages.map(m => (
                        <MessageBubble key={m.id} message={m} />
                      ))}
                    </div>

                    {/* ── Mẫu trả lời nhanh ───────────────────── */}
                    <div className="px-5 py-3 border-t border-outline-variant/30">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">
                        Mẫu trả lời nhanh
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_REPLY_TEMPLATES.map(template => (
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

                    {/* ── Reply box ───────────────────────────── */}
                    <div className="px-5 py-4 border-t border-outline-variant/30">
                      <textarea
                        value={replyInput}
                        onChange={e => setReplyInput(e.target.value)}
                        placeholder="Nhập nội dung trả lời..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />

                      <div className="flex items-center justify-between gap-2 mt-3">
                        {/* Nút đánh dấu giải quyết (toggle) */}
                        <button
                          onClick={toggleResolved}
                          className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-xl transition-colors ${
                            selectedThread.status === 'resolved'
                              ? 'text-green-600 bg-green-500/10 hover:bg-green-500/20'
                              : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <CheckCheck className="w-4 h-4" />
                          {selectedThread.status === 'resolved' ? 'Mở lại câu hỏi' : 'Đánh dấu đã giải quyết'}
                        </button>

                        {/* Nút Gửi */}
                        <button
                          onClick={sendReply}
                          className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                        >
                          <Send className="w-4 h-4" />
                          Gửi
                        </button>
                      </div>
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
