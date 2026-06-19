import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  UserCircle,
  Lock,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  addTeacherQaMessage,
  listTeacherQaThreads,
  QaMessage,
  QaThread,
  QaThreadStatus,
  updateTeacherQaStatus,
} from '../../api/qaService';
import {
  addCourseDiscussionReply,
  listCourseDiscussionThreads,
} from '../../api/courseDiscussionService';
import type { CourseDiscussionThread } from '../../api/courseDiscussionService';
import { listMyCourses } from '../../api/teacherCourseService';
import type { TeacherCourseResponse } from '../../api/teacherCourseService';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: FileText, label: 'Bài giảng', path: '/teacher/content' },
  { icon: PenSquare, label: 'Quiz chương', path: '/teacher/quiz' },
  { icon: Database, label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap, label: 'Bài kiểm tra', path: '/teacher/exam' },
  { icon: ClipboardList, label: 'Chấm điểm', path: '/teacher/grades' },
  { icon: HelpCircle, label: 'Hỏi & Đáp', path: '/teacher/qa' },
  { icon: Megaphone, label: 'Khiếu nại', path: '/teacher/complaints' },
  { icon: BarChart2, label: 'Doanh thu', path: '/teacher/revenue' },
  { icon: Landmark, label: 'TK ngân hàng', path: '/teacher/bank' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/teacher/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/teacher/account' },
];

const QUICK_REPLY_TEMPLATES = [
  'Em xem lại ví dụ trong video bài giảng nhé.',
  'Đây là bước em cần chú ý: ',
  'Em thử làm lại theo hướng này rồi gửi thầy/cô kết quả nhé.',
  'Câu hỏi rất hay. Thầy/cô giải thích thêm như sau: ',
];

function formatRelativeTime(iso: string): string {
  const diffMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarFor(name: string, url: string | null | undefined, size = 36): string {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&size=${size}&background=random&bold=true`;
}

function roleLabel(role: CourseDiscussionThread['authorRole']): string {
  const labels: Record<CourseDiscussionThread['authorRole'], string> = {
    student: 'Học sinh',
    teacher: 'Giáo viên',
    parent: 'Phụ huynh',
    admin: 'Admin',
  };
  return labels[role] ?? role;
}

function hasTeacherReply(thread: CourseDiscussionThread): boolean {
  return thread.replies.some(reply => reply.authorRole === 'teacher' || reply.authorRole === 'admin');
}

function StatusBadge({ status }: { status: QaThreadStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Đang chờ',
      className: 'bg-amber-500/10 text-amber-700',
    },
    answered: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã trả lời',
      className: 'bg-blue-500/10 text-blue-700',
    },
    resolved: {
      icon: <CheckCheck className="w-3.5 h-3.5" />,
      label: 'Đã giải quyết',
      className: 'bg-green-500/10 text-green-700',
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function MessageBubble({ message }: { message: QaMessage }) {
  const isTeacher = message.authorRole === 'teacher';
  return (
    <div className={`flex ${isTeacher ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
        isTeacher
          ? 'bg-primary text-on-primary rounded-br-md'
          : 'bg-surface-container text-on-surface rounded-bl-md'
      }`}>
        <div className={`text-xs font-bold mb-1 ${isTeacher ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
          {message.authorName} · {formatDateTime(message.sentAt)}
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

export default function TeacherQAPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const initialView = new URLSearchParams(location.search).get('tab') === 'common' ? 'common' : 'direct';

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'direct' | 'common'>(initialView);
  const [threads, setThreads] = useState<QaThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QaThreadStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourseResponse[]>([]);
  const [selectedDiscussionCourseId, setSelectedDiscussionCourseId] = useState('');
  const [discussionThreads, setDiscussionThreads] = useState<CourseDiscussionThread[]>([]);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [discussionSearchTerm, setDiscussionSearchTerm] = useState('');
  const [discussionReplyInput, setDiscussionReplyInput] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);
  const [sendingDiscussionReply, setSendingDiscussionReply] = useState(false);

  const selectedThread = threads.find(t => t.id === selectedId) ?? null;
  const selectedCourse = teacherCourses.find(c => c.id === selectedDiscussionCourseId) ?? null;
  const selectedDiscussionThread = discussionThreads.find(t => t.id === selectedDiscussionId) ?? null;

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    threads.forEach(t => map.set(t.courseId, t.courseTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return threads
      .filter(t => courseFilter === 'all' || t.courseId === courseFilter)
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .filter(t => {
        if (!q) return true;
        return (
          t.studentName.toLowerCase().includes(q) ||
          t.courseTitle.toLowerCase().includes(q) ||
          (t.lessonTitle ?? '').toLowerCase().includes(q) ||
          t.messages.some(m => m.content.toLowerCase().includes(q))
        );
      });
  }, [courseFilter, searchTerm, statusFilter, threads]);

  const filteredDiscussionThreads = useMemo(() => {
    const q = discussionSearchTerm.trim().toLowerCase();
    return discussionThreads.filter(thread => {
      if (!q) return true;
      return (
        thread.authorName.toLowerCase().includes(q) ||
        thread.content.toLowerCase().includes(q) ||
        (thread.lessonTitle ?? '').toLowerCase().includes(q) ||
        thread.replies.some(reply =>
          reply.authorName.toLowerCase().includes(q) ||
          reply.content.toLowerCase().includes(q),
        )
      );
    });
  }, [discussionSearchTerm, discussionThreads]);

  async function loadThreads() {
    try {
      setLoading(true);
      const data = await listTeacherQaThreads();
      setThreads(data);
      setSelectedId(prev => prev && data.some(t => t.id === prev) ? prev : data[0]?.id ?? null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được danh sách hỏi đáp');
    } finally {
      setLoading(false);
    }
  }

  async function loadDiscussionCourses() {
    try {
      setLoadingCourses(true);
      const page = await listMyCourses(0, 50);
      const linkedCourseId = new URLSearchParams(location.search).get('courseId') ?? '';
      setTeacherCourses(page.items);
      setSelectedDiscussionCourseId(prev => {
        if (prev && page.items.some(course => course.id === prev)) return prev;
        if (linkedCourseId && page.items.some(course => course.id === linkedCourseId)) return linkedCourseId;
        return page.items[0]?.id ?? '';
      });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được danh sách khóa học');
    } finally {
      setLoadingCourses(false);
    }
  }

  async function loadDiscussionThreads(courseId = selectedDiscussionCourseId) {
    if (!courseId) {
      setDiscussionThreads([]);
      setSelectedDiscussionId(null);
      return;
    }
    try {
      setLoadingDiscussion(true);
      const data = await listCourseDiscussionThreads(courseId);
      setDiscussionThreads(data);
      setSelectedDiscussionId(prev => prev && data.some(thread => thread.id === prev) ? prev : data[0]?.id ?? null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được Q&A chung của khóa học');
    } finally {
      setLoadingDiscussion(false);
    }
  }

  useEffect(() => {
    loadThreads();
    loadDiscussionCourses();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveView(params.get('tab') === 'common' ? 'common' : 'direct');
    const courseId = params.get('courseId');
    if (courseId) setSelectedDiscussionCourseId(courseId);
  }, [location.search]);

  useEffect(() => {
    if (activeView === 'common') {
      loadDiscussionThreads();
    }
  }, [activeView, selectedDiscussionCourseId]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  async function sendReply() {
    if (!selectedThread) return;
    const content = replyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }
    try {
      setSending(true);
      const updated = await addTeacherQaMessage(selectedThread.id, content);
      setThreads(prev => prev.map(t => t.id === updated.id ? updated : t));
      setReplyInput('');
      notify.success('Đã gửi câu trả lời');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được câu trả lời');
    } finally {
      setSending(false);
    }
  }

  async function sendDiscussionReply() {
    if (!selectedDiscussionThread || !selectedDiscussionCourseId) return;
    const content = discussionReplyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung trả lời');
      return;
    }
    try {
      setSendingDiscussionReply(true);
      const updated = await addCourseDiscussionReply(
        selectedDiscussionCourseId,
        selectedDiscussionThread.id,
        content,
      );
      setDiscussionThreads(prev => prev.map(thread => thread.id === updated.id ? updated : thread));
      setDiscussionReplyInput('');
      notify.success('Đã gửi trả lời vào Q&A chung');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được câu trả lời');
    } finally {
      setSendingDiscussionReply(false);
    }
  }

  async function toggleResolved() {
    if (!selectedThread) return;
    try {
      const updated = await updateTeacherQaStatus(
        selectedThread.id,
        selectedThread.status !== 'resolved',
      );
      setThreads(prev => prev.map(t => t.id === updated.id ? updated : t));
      notify.success(updated.status === 'resolved' ? 'Đã đánh dấu đã giải quyết' : 'Đã mở lại câu hỏi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không cập nhật được trạng thái');
    }
  }

  function insertTemplate(template: string) {
    setReplyInput(current => current.trim() ? `${current.trim()}\n${template}` : template);
  }

  return (
    <div className="min-h-screen bg-surface flex font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex`}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg">B</div>
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
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left">
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

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
              src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-on-surface mb-1">Hỏi & Đáp với học sinh</h2>
                <p className="text-on-surface-variant text-sm">Trả lời câu hỏi theo từng cuộc hội thoại và đánh dấu đã giải quyết khi xong.</p>
              </div>
              <button
                onClick={() => activeView === 'common' ? loadDiscussionThreads() : loadThreads()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/50 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
            </div>
          </motion.div>

          <div className="inline-flex bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-1 shadow-sm mb-5">
            <button
              onClick={() => setActiveView('direct')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeView === 'direct'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Hỗ trợ trực tiếp
            </button>
            <button
              onClick={() => setActiveView('common')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeView === 'common'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Q&A chung
            </button>
          </div>

          {activeView === 'direct' && (
            <>
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Khóa học</span>
                <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface">
                  <option value="all">Tất cả khóa</option>
                  {courseOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.title}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Trạng thái</span>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | QaThreadStatus)} className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface">
                  <option value="all">Tất cả</option>
                  <option value="pending">Đang chờ</option>
                  <option value="answered">Đã trả lời</option>
                  <option value="resolved">Đã giải quyết</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tìm kiếm</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tên học sinh, bài học, nội dung..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit">
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />Câu hỏi</span>
                <span className="text-sm text-on-surface-variant font-normal">{filteredThreads.length}</span>
              </h3>

              {loading ? (
                <div className="py-12 flex justify-center text-on-surface-variant">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">Chưa có câu hỏi nào khớp bộ lọc</p>
              ) : (
                <div className="space-y-2 max-h-[620px] overflow-y-auto">
                  {filteredThreads.map(thread => {
                    const isSelected = thread.id === selectedId;
                    const firstMessage = thread.messages[0];
                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedId(thread.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(thread.studentName)}&size=36&background=random&bold=true`}
                            alt={thread.studentName}
                            className="w-8 h-8 rounded-full flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{thread.studentName}</p>
                            <p className="text-xs text-on-surface-variant line-clamp-1">{thread.lessonTitle ?? thread.courseTitle}</p>
                          </div>
                          <StatusBadge status={thread.status} />
                        </div>
                        <p className="text-sm text-on-surface line-clamp-2 mb-2 pl-10">{firstMessage?.content ?? 'Không có nội dung'}</p>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant pl-10">
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{thread.messages.length}</span>
                          <span>{formatRelativeTime(thread.lastActivityAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm flex flex-col min-h-[520px]">
              {!selectedThread ? (
                <div className="text-center py-16 px-5 my-auto">
                  <MessageSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">Chọn một câu hỏi để xem và trả lời</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-b border-outline-variant/30">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-on-surface">{selectedThread.studentName}</p>
                        <p className="text-xs text-on-surface-variant">Bắt đầu: {formatDateTime(selectedThread.createdAt)}</p>
                      </div>
                      <StatusBadge status={selectedThread.status} />
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-on-surface-variant">Câu hỏi về:</span>
                      <Link to="/teacher/content" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                        {selectedThread.lessonTitle ?? selectedThread.courseTitle}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      {selectedThread.lessonTitle && (
                        <span className="text-xs text-on-surface-variant">· {selectedThread.courseTitle}</span>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4 max-h-[430px] overflow-y-auto">
                    {selectedThread.messages.map(message => <MessageBubble key={message.id} message={message} />)}
                  </div>

                  <div className="px-5 py-3 border-t border-outline-variant/30">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">Mẫu trả lời nhanh</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_REPLY_TEMPLATES.map(template => (
                        <button key={template} onClick={() => insertTemplate(template)} className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-medium transition-colors">
                          + {template}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-outline-variant/30 mt-auto">
                    <textarea
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder="Nhập nội dung trả lời..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
                      <button
                        onClick={toggleResolved}
                        className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-xl transition-colors ${
                          selectedThread.status === 'resolved'
                            ? 'text-green-700 bg-green-500/10 hover:bg-green-500/20'
                            : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <CheckCheck className="w-4 h-4" />
                        {selectedThread.status === 'resolved' ? 'Mở lại câu hỏi' : 'Đánh dấu đã giải quyết'}
                      </button>

                      <button
                        onClick={sendReply}
                        disabled={sending}
                        className="flex items-center justify-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-md shadow-primary/20"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Gửi
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
            </>
          )}

          {activeView === 'common' && (
            <>
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Khóa học</span>
                    <select
                      value={selectedDiscussionCourseId}
                      onChange={e => setSelectedDiscussionCourseId(e.target.value)}
                      disabled={loadingCourses || teacherCourses.length === 0}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface disabled:opacity-60"
                    >
                      {teacherCourses.map(course => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tìm kiếm</span>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                      <input
                        type="text"
                        value={discussionSearchTerm}
                        onChange={e => setDiscussionSearchTerm(e.target.value)}
                        placeholder="Học sinh, bài học, nội dung..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {loadingCourses ? (
                <div className="py-16 flex justify-center text-on-surface-variant">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
              ) : teacherCourses.length === 0 ? (
                <div className="text-center py-16 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm">
                  <BookOpen className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">Bạn chưa có khóa học nào để trả lời Q&A chung.</p>
                  <Link to="/teacher/courses" className="inline-flex mt-3 text-primary font-bold hover:underline">
                    Tạo hoặc kiểm tra khóa học
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit">
                    <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />Q&A chung</span>
                      <span className="text-sm text-on-surface-variant font-normal">{filteredDiscussionThreads.length}</span>
                    </h3>
                    {selectedCourse && (
                      <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">{selectedCourse.title}</p>
                    )}

                    {loadingDiscussion ? (
                      <div className="py-12 flex justify-center text-on-surface-variant">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : filteredDiscussionThreads.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-8">Chưa có câu hỏi chung nào khớp bộ lọc</p>
                    ) : (
                      <div className="space-y-2 max-h-[620px] overflow-y-auto">
                        {filteredDiscussionThreads.map(thread => {
                          const isSelected = thread.id === selectedDiscussionId;
                          const answered = hasTeacherReply(thread);
                          return (
                            <button
                              key={thread.id}
                              onClick={() => setSelectedDiscussionId(thread.id)}
                              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 border-primary/30'
                                  : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <img
                                  src={avatarFor(thread.authorName, thread.authorAvatarUrl)}
                                  alt={thread.authorName}
                                  className="w-8 h-8 rounded-full flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{thread.authorName}</p>
                                  <p className="text-xs text-on-surface-variant line-clamp-1">{thread.lessonTitle ?? 'Toàn khóa học'}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                                  answered ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'
                                }`}>
                                  {answered ? 'Đã trả lời' : 'Chưa trả lời'}
                                </span>
                              </div>
                              <p className="text-sm text-on-surface line-clamp-2 mb-2 pl-10">{thread.content}</p>
                              <div className="flex items-center gap-3 text-xs text-on-surface-variant pl-10">
                                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{thread.replies.length}</span>
                                <span>{formatRelativeTime(thread.lastActivityAt)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm flex flex-col min-h-[520px]">
                    {!selectedDiscussionThread ? (
                      <div className="text-center py-16 px-5 my-auto">
                        <MessageSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                        <p className="text-on-surface-variant">Chọn một câu hỏi chung để xem và trả lời</p>
                      </div>
                    ) : (
                      <>
                        <div className="px-5 py-4 border-b border-outline-variant/30">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-on-surface">{selectedDiscussionThread.authorName}</p>
                              <p className="text-xs text-on-surface-variant">
                                {roleLabel(selectedDiscussionThread.authorRole)} · {formatDateTime(selectedDiscussionThread.createdAt)}
                              </p>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              hasTeacherReply(selectedDiscussionThread) ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-700'
                            }`}>
                              {hasTeacherReply(selectedDiscussionThread) ? 'Đã trả lời' : 'Chưa trả lời'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="text-on-surface-variant">Bài giảng:</span>
                            <span className="text-primary font-semibold">{selectedDiscussionThread.lessonTitle ?? 'Toàn khóa học'}</span>
                            {selectedCourse && <span className="text-xs text-on-surface-variant">· {selectedCourse.title}</span>}
                          </div>
                        </div>

                        <div className="px-5 py-4 space-y-4 max-h-[430px] overflow-y-auto">
                          <div className="flex justify-start">
                            <div className="max-w-[86%] rounded-2xl rounded-bl-md px-4 py-3 bg-surface-container text-on-surface">
                              <div className="text-xs font-bold mb-1 text-on-surface-variant">
                                {selectedDiscussionThread.authorName} · {formatDateTime(selectedDiscussionThread.createdAt)}
                              </div>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedDiscussionThread.content}</p>
                            </div>
                          </div>

                          {selectedDiscussionThread.replies.map(reply => {
                            const isTeacher = reply.authorRole === 'teacher' || reply.authorRole === 'admin';
                            return (
                              <div key={reply.id} className={`flex ${isTeacher ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[86%] rounded-2xl px-4 py-3 ${
                                  isTeacher
                                    ? 'bg-primary text-on-primary rounded-br-md'
                                    : 'bg-surface-container text-on-surface rounded-bl-md'
                                }`}>
                                  <div className={`text-xs font-bold mb-1 ${isTeacher ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                                    {reply.authorName} · {roleLabel(reply.authorRole)} · {formatDateTime(reply.createdAt)}
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="px-5 py-3 border-t border-outline-variant/30">
                          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">Mẫu trả lời nhanh</p>
                          <div className="flex flex-wrap gap-2">
                            {QUICK_REPLY_TEMPLATES.map(template => (
                              <button
                                key={template}
                                onClick={() => setDiscussionReplyInput(current => current.trim() ? `${current.trim()}\n${template}` : template)}
                                className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-medium transition-colors"
                              >
                                + {template}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="px-5 py-4 border-t border-outline-variant/30 mt-auto">
                          <textarea
                            value={discussionReplyInput}
                            onChange={e => setDiscussionReplyInput(e.target.value)}
                            placeholder="Nhập nội dung trả lời công khai..."
                            rows={3}
                            className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                          />

                          <div className="flex justify-end mt-3">
                            <button
                              onClick={sendDiscussionReply}
                              disabled={sendingDiscussionReply}
                              className="flex items-center justify-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-md shadow-primary/20"
                            >
                              {sendingDiscussionReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Gửi trả lời
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
