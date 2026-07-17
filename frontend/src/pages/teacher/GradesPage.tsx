import TeacherNotificationBell from '../../components/TeacherNotificationBell';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart2,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Megaphone,
  Paperclip,
  PenSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  UserCircle,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { isApiError } from '../../api/client';
import {
  createAssignment,
  deleteAssignment,
  gradeAssignmentSubmission,
  listTeacherAssignments,
  listTeacherAssignmentSubmissions,
  type AssignmentSubmissionResponse,
  type AssignmentSubmissionStatus,
  type TeacherAssignmentResponse,
} from '../../api/assignmentService';
import {
  getCourseDetail,
  listMyCourses,
  type TeacherChapterResponse,
  type TeacherCourseResponse,
} from '../../api/teacherCourseService';
import {
  gradeTeacherExamAttempt,
  listTeacherExamAttempts,
  type TeacherExamAttemptResponse,
} from '../../api/examService';
import RetakeRequestsPanel from '../../components/teacher/RetakeRequestsPanel';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: Star, label: 'Đánh giá khóa học', path: '/teacher/reviews' },
  { icon: FileText, label: 'Bài giảng', path: '/teacher/content' },
  { icon: PenSquare, label: 'Quiz chương', path: '/teacher/quiz' },
  { icon: Database, label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap, label: 'Bài kiểm tra', path: '/teacher/exam' },
  { icon: ClipboardList, label: 'Chấm tự luận', path: '/teacher/grades' },
  { icon: HelpCircle, label: 'Hỏi & Đáp', path: '/teacher/qa' },
  { icon: Megaphone, label: 'Khiếu nại', path: '/teacher/complaints' },
  { icon: BarChart2, label: 'Doanh thu', path: '/teacher/revenue' },
  { icon: Landmark, label: 'TK ngân hàng', path: '/teacher/bank' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/teacher/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/teacher/account' },
] as const;

const FEEDBACK_TEMPLATES = [
  'Bài làm có bố cục rõ ràng và lập luận hợp lý.',
  'Em cần bổ sung dẫn chứng để làm rõ lập luận.',
  'Cần trình bày chi tiết hơn các bước giải.',
  'Em nên kiểm tra lại chính tả và cách diễn đạt.',
  'Bài làm tốt, tiếp tục phát huy.',
];

function formatDateTime(value: string | null): string {
  if (!value) return 'Không có';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isManualExamQuestionType(type: string) {
  return ['essay', 'essay_short', 'essay_long', 'file_upload'].includes(type);
}

function objectiveAnswerLabel(question: TeacherExamAttemptResponse['questions'][number]) {
  return question.correctAnswers
    .map(index => String.fromCharCode(65 + index))
    .join(', ');
}

function studentName(submission: AssignmentSubmissionResponse): string {
  return submission.studentName?.trim() || 'Học sinh';
}

function StatusBadge({ status }: { status: AssignmentSubmissionStatus }) {
  const config = {
    pending: {
      label: 'Chưa chấm',
      icon: Clock,
      className: 'bg-amber-500/10 text-amber-600',
    },
    graded: {
      label: 'Đã chấm',
      icon: CheckCircle2,
      className: 'bg-green-500/10 text-green-600',
    },
    resubmit: {
      label: 'Nộp lại',
      icon: RotateCcw,
      className: 'bg-red-500/10 text-red-600',
    },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

// Modal quản lý bài tập tự luận (UC16): GV tạo bài tập gắn vào chương,
// xem danh sách bài đã giao và xóa khi cần. Học sinh nộp bài qua tab
// "Bài tập" trong trang học của khóa.
function AssignmentManagerModal({ onClose }: { onClose: () => void }) {
  const [assignments, setAssignments] = useState<TeacherAssignmentResponse[]>([]);
  const [courses, setCourses] = useState<TeacherCourseResponse[]>([]);
  const [chapters, setChapters] = useState<TeacherChapterResponse[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTeacherAssignments(), listMyCourses(0, 50)])
      .then(([assignmentData, coursePage]) => {
        if (cancelled) return;
        setAssignments(assignmentData);
        setCourses(coursePage.items);
      })
      .catch(err => {
        if (!cancelled) {
          notify.error(isApiError(err) ? err.message : 'Không tải được danh sách bài tập');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setChapterId('');
    setChapters([]);
    if (!courseId) return;
    let cancelled = false;
    setLoadingChapters(true);
    getCourseDetail(courseId)
      .then(detail => {
        if (!cancelled) setChapters(detail.chapters);
      })
      .catch(err => {
        if (!cancelled) {
          notify.error(isApiError(err) ? err.message : 'Không tải được danh sách chương');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingChapters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleCreate() {
    if (!chapterId) {
      notify.error('Chọn chương cho bài tập');
      return;
    }
    if (!title.trim()) {
      notify.error('Nhập tiêu đề bài tập');
      return;
    }
    const parsedMaxScore = Number(maxScore);
    if (!Number.isInteger(parsedMaxScore) || parsedMaxScore < 1 || parsedMaxScore > 100) {
      notify.error('Điểm tối đa phải là số nguyên từ 1 đến 100');
      return;
    }
    setCreating(true);
    try {
      const created = await createAssignment({
        chapterId,
        title: title.trim(),
        description: description.trim() || undefined,
        maxScore: parsedMaxScore,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      setAssignments(prev => [created, ...prev]);
      setTitle('');
      setDescription('');
      setDueAt('');
      notify.success('Đã tạo bài tập');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Tạo bài tập thất bại');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(assignmentId: string) {
    setDeletingId(assignmentId);
    try {
      await deleteAssignment(assignmentId);
      setAssignments(prev => prev.filter(item => item.id !== assignmentId));
      notify.success('Đã xóa bài tập');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Xóa bài tập thất bại');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-on-surface">Quản lý bài tập tự luận</h3>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-surface-container rounded-2xl p-4 space-y-3">
          <h4 className="font-bold text-sm text-on-surface">Giao bài tập mới</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={courseId}
              onChange={event => setCourseId(event.target.value)}
              className="px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
            >
              <option value="">— Chọn khóa học —</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
            <select
              value={chapterId}
              onChange={event => setChapterId(event.target.value)}
              disabled={!courseId || loadingChapters}
              className="px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">
                {loadingChapters ? 'Đang tải chương...' : '— Chọn chương —'}
              </option>
              {chapters.map(chapter => (
                <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
              ))}
            </select>
          </div>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Tiêu đề bài tập"
            className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            rows={3}
            placeholder="Đề bài / hướng dẫn làm bài (không bắt buộc)"
            className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-on-surface-variant">
              Điểm tối đa
              <input
                type="number"
                min={1}
                max={100}
                value={maxScore}
                onChange={event => setMaxScore(event.target.value)}
                className="mt-1 w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="text-sm font-semibold text-on-surface-variant">
              Hạn nộp (không bắt buộc)
              <input
                type="datetime-local"
                value={dueAt}
                onChange={event => setDueAt(event.target.value)}
                className="mt-1 w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Đang tạo...' : 'Tạo bài tập'}
          </button>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-sm text-on-surface">Bài tập đã giao ({assignments.length})</h4>
          {loadingList ? (
            <div className="flex items-center gap-2 text-on-surface-variant py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Đang tải...
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-4 text-center">
              Chưa có bài tập nào. Tạo bài tập đầu tiên ở form phía trên.
            </p>
          ) : (
            assignments.map(assignment => (
              <div
                key={assignment.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-on-surface truncate">{assignment.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {assignment.courseTitle ?? 'Khóa học'}
                    {assignment.chapterTitle && <> · {assignment.chapterTitle}</>}
                    {' · '}Tối đa {assignment.maxScore} điểm
                    {assignment.dueAt && <> · Hạn: {formatDateTime(assignment.dueAt)}</>}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(assignment.id)}
                  disabled={deletingId === assignment.id}
                  className="p-2 text-on-surface-variant hover:text-red-500 disabled:opacity-50 flex-shrink-0"
                  title="Xóa bài tập"
                >
                  {deletingId === assignment.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherGradesPage() {
  const [submissions, setSubmissions] = useState<AssignmentSubmissionResponse[]>([]);
  const [examAttempts, setExamAttempts] = useState<TeacherExamAttemptResponse[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentSubmissionStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [examScoreInput, setExamScoreInput] = useState('');
  const [examFeedbackInput, setExamFeedbackInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAssignmentManagerOpen, setIsAssignmentManagerOpen] = useState(false);
  const didLoadRef = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  async function loadSubmissions(showSuccess = false) {
    setLoading(true);
    try {
      const [data, examData] = await Promise.all([
        listTeacherAssignmentSubmissions(),
        listTeacherExamAttempts(),
      ]);
      setSubmissions(data);
      setExamAttempts(
        [...examData].sort((a, b) => {
          if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }),
      );
      if (showSuccess) notify.success('Đã làm mới danh sách bài tự luận.');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không thể tải bài tự luận đã nộp.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    loadSubmissions();
  }, []);

  const courseOptions = useMemo(() => {
    const values = new Map<string, string>();
    submissions.forEach(item => values.set(item.courseId, item.courseTitle));
    return Array.from(values, ([id, title]) => ({ id, title }));
  }, [submissions]);

  const assignmentOptions = useMemo(() => {
    const values = new Map<string, string>();
    submissions
      .filter(item => courseFilter === 'all' || item.courseId === courseFilter)
      .forEach(item => values.set(item.assignmentId, item.assignmentTitle));
    return Array.from(values, ([id, title]) => ({ id, title }));
  }, [submissions, courseFilter]);

  const filteredSubmissions = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('vi-VN');
    return submissions.filter(item => {
      if (courseFilter !== 'all' && item.courseId !== courseFilter) return false;
      if (assignmentFilter !== 'all' && item.assignmentId !== assignmentFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return !term || studentName(item).toLocaleLowerCase('vi-VN').includes(term);
    });
  }, [submissions, courseFilter, assignmentFilter, statusFilter, searchTerm]);

  useEffect(() => {
    if (filteredSubmissions.length === 0) {
      setSelectedId(null);
    } else if (!filteredSubmissions.some(item => item.id === selectedId)) {
      setSelectedId(filteredSubmissions[0].id);
    }
  }, [filteredSubmissions, selectedId]);

  const selected = submissions.find(item => item.id === selectedId) ?? null;
  const selectedExam = examAttempts.find(item => item.id === selectedExamId) ?? null;

  useEffect(() => {
    setScoreInput(selected?.score != null ? String(selected.score) : '');
    setFeedbackInput(selected?.feedback ?? '');
  }, [selected?.id]);

  useEffect(() => {
    if (examAttempts.length === 0) {
      setSelectedExamId(null);
    } else if (!examAttempts.some(item => item.id === selectedExamId)) {
      setSelectedExamId(examAttempts[0].id);
    }
  }, [examAttempts, selectedExamId]);

  useEffect(() => {
    setExamScoreInput(selectedExam?.effectiveScorePercent != null
      ? String(selectedExam.effectiveScorePercent)
      : '');
    setExamFeedbackInput(selectedExam?.feedback ?? '');
  }, [selectedExam?.id]);

  const stats = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter(item => item.status === 'pending').length,
    resubmit: submissions.filter(item => item.status === 'resubmit').length,
    graded: submissions.filter(item => item.status === 'graded').length,
  }), [submissions]);

  function changeCourse(courseId: string) {
    setCourseFilter(courseId);
    setAssignmentFilter('all');
  }

  function appendFeedback(template: string) {
    setFeedbackInput(current => current ? `${current}\n${template}` : template);
  }

  async function handleSaveGrade() {
    if (!selected || saving) return;
    const score = Number(scoreInput);
    if (!Number.isFinite(score)) {
      notify.error('Vui lòng nhập điểm hợp lệ.');
      return;
    }
    if (score < 0 || score > selected.maxScore) {
      notify.error(`Điểm phải từ 0 đến ${selected.maxScore}.`);
      return;
    }

    setSaving(true);
    const toastId = notify.loading('Đang lưu kết quả chấm...');
    try {
      const updated = await gradeAssignmentSubmission(
        selected.id,
        score,
        feedbackInput.trim(),
      );
      setSubmissions(current => current.map(item => item.id === updated.id ? updated : item));
      notify.dismiss(toastId);
      notify.success('Đã lưu điểm bài tự luận.');
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Không thể lưu điểm.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExamGrade() {
    if (!selectedExam || saving) return;
    const score = Number(examScoreInput);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      notify.error('Điểm bài kiểm tra phải từ 0 đến 100%.');
      return;
    }
    setSaving(true);
    const toastId = notify.loading('Đang lưu điểm bài kiểm tra...');
    try {
      const updated = await gradeTeacherExamAttempt(
        selectedExam.id,
        score,
        examFeedbackInput.trim(),
      );
      setExamAttempts(current => current.map(item => item.id === updated.id ? updated : item));
      notify.dismiss(toastId);
      notify.success('Đã lưu điểm bài kiểm tra.');
    } catch (err) {
      notify.dismiss(toastId);
      notify.error(isApiError(err) ? err.message : 'Không thể lưu điểm bài kiểm tra.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface flex font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-surface-container-lowest
        border-r border-outline-variant/30 flex flex-col transition-transform duration-300
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
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {active && <span className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline-variant/20">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50">
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Chấm điểm bài tự luận</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-extrabold">Chấm bài tự luận</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Đọc nội dung bài làm, tải file đính kèm và gửi điểm cùng nhận xét cho học sinh.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAssignmentManagerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Quản lý bài tập
              </button>
              <button
                onClick={() => loadSubmissions(true)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-sm font-bold hover:text-primary disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="mb-6">
            <RetakeRequestsPanel />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Tổng bài nộp', value: stats.total, color: 'text-primary' },
              { label: 'Chưa chấm', value: stats.pending, color: 'text-amber-600' },
              { label: 'Cần chấm lại', value: stats.resubmit, color: 'text-red-500' },
              { label: 'Đã chấm', value: stats.graded, color: 'text-green-600' },
            ].map(item => (
              <div key={item.label} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
                <p className={`text-2xl font-extrabold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-on-surface-variant font-semibold mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <select value={courseFilter} onChange={event => changeCourse(event.target.value)} className="px-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary">
                <option value="all">Tất cả khóa học</option>
                {courseOptions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
              <select value={assignmentFilter} onChange={event => setAssignmentFilter(event.target.value)} className="px-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary">
                <option value="all">Tất cả bài tự luận</option>
                {assignmentOptions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="px-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary">
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chưa chấm</option>
                <option value="resubmit">Nộp lại</option>
                <option value="graded">Đã chấm</option>
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Tìm tên học sinh..." className="w-full pl-9 pr-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-80">
                <h3 className="font-extrabold flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Bài kiểm tra đã nộp
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {examAttempts.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Chưa có lượt làm bài kiểm tra.</p>
                  ) : examAttempts.map(attempt => (
                    <button
                      key={attempt.id}
                      onClick={() => setSelectedExamId(attempt.id)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition-all ${
                        attempt.id === selectedExamId
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-outline-variant/30 bg-surface-container/30 hover:border-primary/30'
                      }`}
                    >
                      <p className="font-bold">{attempt.studentName ?? 'Học sinh'}</p>
                      <p className="text-xs text-on-surface-variant">{attempt.examName}</p>
                      <p className="text-xs font-semibold mt-1">
                        {attempt.status === 'graded' ? `Đã chấm: ${attempt.effectiveScorePercent}%` : 'Chưa chấm tự luận'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {!selectedExam ? (
                  <p className="text-sm text-on-surface-variant">Chọn một lượt làm bài kiểm tra để xem phần tự luận.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold">{selectedExam.studentName ?? 'Học sinh'}</p>
                        <p className="text-sm text-on-surface-variant">{selectedExam.courseTitle} · {selectedExam.examName}</p>
                      </div>
                      {selectedExam.autoScorePercent != null && (
                        <div className="rounded-xl border border-outline-variant/40 bg-surface-container/40 px-3 py-2 text-right">
                          <p className="text-[11px] uppercase font-bold text-on-surface-variant">Trắc nghiệm (tự động)</p>
                          <p className="text-lg font-extrabold text-on-surface">{selectedExam.autoScorePercent}%</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {selectedExam.questions.map((question, index) => (
                        <div key={question.id} className="rounded-xl border border-outline-variant/30 bg-surface-container/30 p-3">
                          <p className="text-sm font-bold">Câu {index + 1}: {question.text}</p>
                          {isManualExamQuestionType(question.type) ? (
                            <div className="mt-2 space-y-2">
                              <p className="text-sm whitespace-pre-wrap">
                                {question.textAnswer || 'Học sinh không nhập văn bản.'}
                              </p>
                              {question.imageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {question.imageUrls.map((url, fileIndex) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary underline">
                                      Ảnh {fileIndex + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {question.type === 'file_upload' && question.answerData && (
                                <p className="text-xs text-on-surface-variant">
                                  Dạng bài nộp file đã được ghi nhận trong bài làm thủ công.
                                </p>
                              )}
                            </div>
                          ) : question.type === 'fill_in_blank' ? (
                            <div className="mt-2 space-y-1 text-sm">
                              <p><span className="font-bold">Học sinh trả lời:</span> {question.textAnswer || 'Không có'}</p>
                              <p className="text-on-surface-variant">
                                Đáp án chấp nhận: {(question.metadata?.acceptedAnswers ?? []).join(', ') || 'Không có'}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                Tự chấm: {question.earnedPoints}/{question.points} điểm
                              </p>
                            </div>
                          ) : question.type === 'matching' ? (
                            <div className="mt-2 space-y-2">
                              {(((question.answerData?.matchingPairs as Array<{ left: string; right: string }> | undefined) ?? []))
                                .map((pair, pairIndex) => (
                                  <div key={pairIndex} className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="rounded-lg bg-surface px-2 py-1">{pair.left}</span>
                                    <span className="rounded-lg bg-surface px-2 py-1">{pair.right}</span>
                                  </div>
                                ))}
                              {(question.metadata?.matchingPairs?.length ?? 0) > 0 && (
                                <div className="rounded-lg bg-surface px-3 py-2 text-xs text-on-surface-variant">
                                  Đáp án đúng:
                                  {' '}
                                  {question.metadata?.matchingPairs?.map(pair => `${pair.left} -> ${pair.right}`).join(' | ')}
                                </div>
                              )}
                              <p className="text-xs text-on-surface-variant">
                                Tự chấm: {question.earnedPoints}/{question.points} điểm
                              </p>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                              <p>Trắc nghiệm: {question.earnedPoints}/{question.points} điểm</p>
                              <p>Đáp án đúng: {objectiveAnswerLabel(question) || 'Không có'}</p>
                              <p>Học sinh chọn: {question.studentAnswers.map(index => String.fromCharCode(65 + index)).join(', ') || 'Không chọn'}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedExam.aiGradedAt && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                            Gợi ý từ AI (tham khảo)
                          </span>
                          {selectedExam.aiScorePercent != null && (
                            <span className="ml-auto rounded-full bg-primary/15 px-2.5 py-1 text-xs font-extrabold text-primary">
                              AI đề xuất: {selectedExam.aiScorePercent}%
                            </span>
                          )}
                        </div>
                        {selectedExam.aiFeedback?.overallComment && (
                          <p className="mt-2 text-sm text-on-surface-variant">{selectedExam.aiFeedback.overallComment}</p>
                        )}
                        {selectedExam.aiFeedback?.questions?.length ? (
                          <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
                            {selectedExam.aiFeedback.questions.map((q, index) => (
                              <li key={q.questionId}>
                                <span className="font-bold text-on-surface">Câu tự luận {index + 1}:</span>
                                {' '}AI {q.earnedPoints}/{q.maxPoints}đ — {q.comment}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {selectedExam.aiFeedback?.overallComment && (
                          <button
                            type="button"
                            onClick={() => setExamFeedbackInput(selectedExam.aiFeedback?.overallComment ?? '')}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                          >
                            Chép nhận xét AI vào ô bên dưới
                          </button>
                        )}
                        <p className="mt-3 text-[11px] italic text-on-surface-variant">
                          Đây là gợi ý sơ bộ của AI. Điểm và nhận xét chính thức do thầy/cô quyết định.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3 items-end border-t border-outline-variant/20 pt-4">
                      <label className="block">
                        <span className="text-xs uppercase font-extrabold text-on-surface-variant mb-1.5 block">Điểm %</span>
                        <input value={examScoreInput} onChange={event => setExamScoreInput(event.target.value)} type="number" min={0} max={100} className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
                        {selectedExam.autoScorePercent != null && (
                          <span className="mt-1 block text-[11px] text-on-surface-variant">
                            Tham khảo trắc nghiệm: {selectedExam.autoScorePercent}%
                          </span>
                        )}
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase font-extrabold text-on-surface-variant mb-1.5 block">Nhận xét</span>
                        <input value={examFeedbackInput} onChange={event => setExamFeedbackInput(event.target.value)} className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary" />
                      </label>
                      <button onClick={handleSaveExamGrade} disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-60">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu điểm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <section className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm h-fit">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-extrabold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Bài học sinh đã nộp
                  </h3>
                  <span className="text-xs text-on-surface-variant">{filteredSubmissions.length} bài</span>
                </div>
                {filteredSubmissions.length === 0 ? (
                  <div className="text-center py-14">
                    <AlertCircle className="w-10 h-10 text-on-surface-variant/25 mx-auto mb-3" />
                    <p className="text-sm text-on-surface-variant">
                      {submissions.length === 0 ? 'Chưa có học sinh nộp bài tự luận.' : 'Không có bài phù hợp bộ lọc.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                    {filteredSubmissions.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          item.id === selectedId ? 'bg-primary/10 border-primary/40' : 'bg-surface-container/30 border-outline-variant/30 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(studentName(item))}&background=random&bold=true`} alt={studentName(item)} className="w-10 h-10 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{studentName(item)}</p>
                            <p className="text-xs text-on-surface-variant truncate">{item.assignmentTitle}</p>
                            <p className="text-[11px] text-on-surface-variant/70 truncate">{item.courseTitle}</p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="flex justify-between items-center mt-3 pl-13 text-xs text-on-surface-variant">
                          <span>{formatDateTime(item.submittedAt)}</span>
                          <span className="font-bold">
                            {item.status === 'graded' ? `${item.score}/${item.maxScore}` : `Lần ${item.attemptNumber}`}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="xl:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm min-h-[560px]">
                {!selected ? (
                  <div className="h-full flex flex-col justify-center items-center py-20 text-center">
                    <FileText className="w-12 h-12 text-on-surface-variant/25 mb-4" />
                    <p className="text-on-surface-variant">Chọn một bài nộp để bắt đầu chấm.</p>
                  </div>
                ) : (
                  <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-outline-variant/30">
                      <div>
                        <h3 className="text-lg font-extrabold">{studentName(selected)}</h3>
                        <p className="font-semibold mt-1">{selected.assignmentTitle}</p>
                        <p className="text-xs text-on-surface-variant">{selected.courseTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selected.late && <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">Nộp muộn</span>}
                        <StatusBadge status={selected.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                      <div className="rounded-xl bg-surface-container p-3">
                        <p className="text-[11px] uppercase font-bold text-on-surface-variant">Lần nộp</p>
                        <p className="font-extrabold mt-1">{selected.attemptNumber}</p>
                      </div>
                      <div className="rounded-xl bg-surface-container p-3">
                        <p className="text-[11px] uppercase font-bold text-on-surface-variant">Nộp lúc</p>
                        <p className="text-xs font-bold mt-1">{formatDateTime(selected.submittedAt)}</p>
                      </div>
                      <div className="rounded-xl bg-surface-container p-3">
                        <p className="text-[11px] uppercase font-bold text-on-surface-variant">Hạn nộp</p>
                        <p className="text-xs font-bold mt-1">{formatDateTime(selected.dueAt)}</p>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-3">
                        <p className="text-[11px] uppercase font-bold text-primary">Thang điểm</p>
                        <p className="font-extrabold text-primary mt-1">{selected.maxScore}</p>
                      </div>
                    </div>

                    {selected.assignmentInstructions && (
                      <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <p className="text-xs uppercase font-extrabold text-blue-600 mb-1.5">Yêu cầu đề bài</p>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">{selected.assignmentInstructions}</p>
                      </div>
                    )}

                    <div className="mb-5">
                      <h4 className="font-extrabold text-sm mb-2">Nội dung bài làm</h4>
                      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container/30 p-4 min-h-36">
                        {selected.answerText
                          ? <p className="text-sm leading-7 whitespace-pre-wrap">{selected.answerText}</p>
                          : <p className="text-sm italic text-on-surface-variant">Học sinh không nhập nội dung văn bản.</p>}
                      </div>
                    </div>

                    <div className="mb-5">
                      <h4 className="font-extrabold text-sm mb-2">File đính kèm</h4>
                      {selected.files.length > 0 ? (
                        <div className="space-y-2">
                          {selected.files.map((file, index) => (
                            <a
                              key={`${file.url}-${index}`}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container p-3 hover:border-primary/50 transition-colors"
                            >
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Paperclip className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">
                                  {file.name ?? `Tệp đính kèm ${index + 1}`}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  {formatFileSize(file.sizeBytes)}
                                </p>
                              </div>
                              <Download className="w-5 h-5 text-primary" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">Không có file đính kèm.</p>
                      )}
                    </div>

                    <div className="border-t border-outline-variant/30 pt-5 space-y-4">
                      <label className="block">
                        <span className="text-xs uppercase font-extrabold text-on-surface-variant mb-1.5 block">
                          Điểm số
                        </span>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} max={selected.maxScore} step={1} value={scoreInput} onChange={event => setScoreInput(event.target.value)} className="w-28 px-3 py-2.5 text-lg font-extrabold text-center bg-surface-container border border-outline-variant rounded-xl outline-none focus:border-primary" />
                          <span className="font-bold text-on-surface-variant">/ {selected.maxScore}</span>
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-xs uppercase font-extrabold text-on-surface-variant mb-1.5 block">
                          Nhận xét cho học sinh
                        </span>
                        <textarea value={feedbackInput} onChange={event => setFeedbackInput(event.target.value)} rows={5} maxLength={3000} placeholder="Nhận xét về nội dung, lập luận, cách trình bày và điểm cần cải thiện..." className="w-full px-3 py-3 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary resize-none" />
                        <span className="block text-right text-[11px] text-on-surface-variant mt-1">{feedbackInput.length}/3000</span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {FEEDBACK_TEMPLATES.map(template => (
                          <button key={template} onClick={() => appendFeedback(template)} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20">
                            + {template}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-outline-variant/20">
                        <p className="text-xs text-on-surface-variant">
                          {selected.gradedAt ? `Chấm lần cuối: ${formatDateTime(selected.gradedAt)}` : 'Bài chưa được chấm.'}
                        </p>
                        <button onClick={handleSaveGrade} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-60 shadow-md shadow-primary/20">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {selected.status === 'graded' ? 'Cập nhật điểm' : 'Lưu & hoàn thành'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {isAssignmentManagerOpen && (
        <AssignmentManagerModal onClose={() => setIsAssignmentManagerOpen(false)} />
      )}
    </div>
  );
}
