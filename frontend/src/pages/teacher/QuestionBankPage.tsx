import {
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  PenSquare,
  Plus,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
  UserCircle,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { QuestionBankResponse } from '../../api/questionBankService';
import type {
  Difficulty,
  QuestionAuditLogResponse,
  QuestionResponse,
  QuestionStatus,
  QuestionVersionResponse
} from '../../api/questionService';
import * as questionService from '../../api/questionService';
import type { TeacherChapterResponse } from '../../api/teacherCourseService';
import { getCourseDetail } from '../../api/teacherCourseService';
import TeacherNotificationBell from '../../components/TeacherNotificationBell';
import { notify } from '../../lib/toast';
import { useAuthStore } from '../../store/useAuthStore';

const ExcelImportModal = lazy(() => import('./ExcelImportModal'));
const AIScanModal = lazy(() => import('./AIScanModal'));
const QuestionFormPanel = lazy(() => import('./question-bank/QuestionFormPanel'));
const QuestionBankCreateDialog = lazy(() => import('./question-bank/QuestionBankCreateDialog'));

// Navigation and helpers

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: Star, label: 'Đánh giá khóa học', path: '/teacher/reviews' },
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

import ConfirmBulkDeleteDialog from './question-bank/ConfirmBulkDeleteDialog';
import ConfirmDeleteDialog from './question-bank/ConfirmDeleteDialog';
import {
  QUESTION_FETCH_LIMIT,
  useQuestionBankData,
} from './question-bank/hooks/useQuestionBankData';
import {
  DIFFICULTY_OPTS,
  DifficultyBadge,
  formatDate,
  ModalLoadingFallback,
  QUESTION_TYPE_FILTER_OPTS,
  questionTypeFilterLabel,
  STATUS_OPTS,
  truncate,
  typeLabel,
  type BankQuestionType,
} from './question-bank/questionBankUtils';
import QuestionHistoryDialog from './question-bank/QuestionHistoryDialog';
import BrandLogo from '../../components/BrandLogo';

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout  = useAuthStore(s => s.logout);
  const user    = useAuthStore(s => s.user);

  const [allChapters, setAllChapters] = useState<TeacherChapterResponse[]>([]);

  // Filters
  const [diffFilter,    setDiffFilter]    = useState<Difficulty | 'all'>('all');
  const [statusFilter,  setStatusFilter]  = useState<QuestionStatus | 'all'>('all');
  const [typeFilter,    setTypeFilter]    = useState<BankQuestionType | 'all'>('all');
  const [bankFilter,    setBankFilter]    = useState('');
  const [categoryFilter,setCategoryFilter]= useState('');
  const [gradeFilter,   setGradeFilter]   = useState('');
  const [courseFilter,  setCourseFilter]  = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const {
    questions,
    banks,
    totalItems,
    categories,
    courses,
    loadingQuestions: loadingQ,
    loadingBanks,
    reloadQuestions: loadQuestions,
    reloadPageData,
    refreshBanks,
  } = useQuestionBankData({
    difficulty: diffFilter,
    status: statusFilter,
    bankId: bankFilter,
    categoryId: categoryFilter,
    grade: gradeFilter,
    chapterId: chapterFilter,
  });

  // Panel and dialog state
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [importOpen,     setImportOpen]     = useState(false);
  const [aiScanOpen,     setAiScanOpen]     = useState(false);
  const [editingQ,       setEditingQ]       = useState<QuestionResponse | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<QuestionResponse | null>(null);
  const [historyTarget,  setHistoryTarget]  = useState<QuestionResponse | null>(null);
  const [historyVersions,setHistoryVersions]= useState<QuestionVersionResponse[]>([]);
  const [historyAudits,  setHistoryAudits]  = useState<QuestionAuditLogResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);


  // Load chapters when a course filter is selected.
  useEffect(() => {
    if (!courseFilter) { setAllChapters([]); setChapterFilter(''); return; }
    getCourseDetail(courseFilter)
      .then(d => {
        setAllChapters(d.chapters);
        setCategoryFilter(d.categoryId ?? '');
        setGradeFilter(d.grades?.[0] ? String(d.grades[0]) : '');
      })
      .catch(() => {});
    setChapterFilter('');
  }, [courseFilter]);

  // Per-request fetch limit for the question bank.

  const filteredQuestions = typeFilter === 'all'
    ? questions
    : questions.filter(question => question.type === typeFilter);

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filteredQuestions.some(question => question.id === id)));
  }, [filteredQuestions]);

  // Actions
  function openAdd()  { setEditingQ(null); setPanelOpen(true); }
  function openEdit(q: QuestionResponse) { setEditingQ(q); setPanelOpen(true); }
  async function openHistory(q: QuestionResponse) {
    setHistoryTarget(q);
    setHistoryLoading(true);
    setHistoryVersions([]);
    setHistoryAudits([]);
    try {
      const [versions, audits] = await Promise.all([
        questionService.listQuestionVersions(q.id),
        questionService.listQuestionAuditLogs(q.id),
      ]);
      setHistoryVersions(versions);
      setHistoryAudits(audits);
    } catch {
      notify.error('Không tải được lịch sử câu hỏi');
    } finally {
      setHistoryLoading(false);
    }
  }
  function handleQuestionBankCreated(bank: QuestionBankResponse) {
    setBankFilter(bank.id);
    refreshBanks();
  }

  const allQuestionIds = filteredQuestions.map(q => q.id);
  const selectedCount = selectedIds.length;
  const allSelected = allQuestionIds.length > 0 && allQuestionIds.every(id => selectedIds.includes(id));

  function toggleSelectQuestion(questionId: string) {
    setSelectedIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId],
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : allQuestionIds);
  }

  async function confirmBulkDelete() {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    const idsToDelete = [...selectedIds];
    const results = await Promise.allSettled(idsToDelete.map(id => questionService.deleteQuestion(id)));
    const deleted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - deleted;

    if (deleted > 0) notify.success(`Đã xóa ${deleted} câu hỏi`);
    if (failed > 0) notify.error(`${failed} câu hỏi chưa xóa được`);

    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    reloadPageData();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await questionService.deleteQuestion(deleteTarget.id);
      notify.success('Đã xóa câu hỏi');
      setDeleteTarget(null);
      reloadPageData();
    } catch {
      notify.error('Không xóa được câu hỏi');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // Stats
  const stats = {
    total:  filteredQuestions.length,
    easy:   filteredQuestions.filter(q => q.difficulty === 'easy').length,
    medium: filteredQuestions.filter(q => q.difficulty === 'medium').length,
    hard:   filteredQuestions.filter(q => q.difficulty === 'hard').length,
  };

  const selectedBank = banks.find(bank => bank.id === bankFilter) ?? null;
  const hasFilter = diffFilter !== 'all'
    || statusFilter !== 'all'
    || typeFilter !== 'all'
    || bankFilter
    || categoryFilter
    || gradeFilter
    || courseFilter
    || chapterFilter;

  // Render
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <BrandLogo size="sm" />
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
              <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {active && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline-variant/20">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Ngân hàng câu hỏi</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar" className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Title + nút thêm */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-5 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Ngân hàng câu hỏi</h2>
              {!loadingQ && (
                <p className="text-on-surface-variant mt-1 text-sm">
                  {/* Nếu totalItems > FETCH_LIMIT: hiển thị số thật để GV biết đang bị cắt */}
                  <span className="font-bold text-on-surface">
                    {totalItems > QUESTION_FETCH_LIMIT ? `${stats.total}/${totalItems}` : stats.total}
                  </span> câu hỏi
                  {stats.total > 0 && (
                    <span className="ml-2 text-on-surface-variant/60">
                      · {stats.easy} dễ · {stats.medium} trung bình · {stats.hard} khó
                    </span>
                  )}
                  {selectedBank && (
                    <span className="ml-2 text-primary/80">
                      · đang xem bank: {selectedBank.title}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                  <span className="text-xs font-bold text-red-700 px-1">{selectedCount} đã chọn</span>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-100"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    onClick={() => setBulkDeleteOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
                  </button>
                </div>
              )}
              <button onClick={reloadPageData} disabled={loadingQ}
                className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                title="Làm mới"
              >
                <RefreshCcw className={`w-5 h-5 ${loadingQ ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setBankDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" /> Tạo bank
              </button>
              <button
                onClick={() => setAiScanOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-500/20"
              >
                <Sparkles className="w-4 h-4" /> Scan PDF
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-md shadow-green-500/20"
              >
                <FileSpreadsheet className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
              >
                <Plus className="w-5 h-5" /> Thêm câu hỏi
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="mb-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface">Danh sách question bank</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Tạo bank rỗng, chọn đúng môn học và lớp, rồi tiếp tục bổ sung câu hỏi vào từng bank.
                </p>
              </div>
              <button
                onClick={() => setBankDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ngân hàng mới
              </button>
            </div>

            {loadingBanks ? (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Đang tải danh sách ngân hàng câu hỏi...
              </div>
            ) : banks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface px-4 py-8 text-center">
                <Database className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="font-bold text-on-surface">Chưa có question bank nào</p>
                <p className="text-sm text-on-surface-variant mt-1 mb-4">
                  Tạo bank đầu tiên để quản lý câu hỏi theo từng nhóm nội dung.
                </p>
                <button
                  onClick={() => setBankDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Tạo question bank
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <button
                  onClick={() => setBankFilter('')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    !bankFilter
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/40 bg-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">Tất cả câu hỏi</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Bỏ lọc theo question bank
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      {banks.length} bank
                    </span>
                  </div>
                </button>

                {banks.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => setBankFilter(current => current === bank.id ? '' : bank.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      bankFilter === bank.id
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/40 bg-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-on-surface truncate">{bank.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {bank.categoryName} · Lớp {bank.grade}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary whitespace-nowrap">
                        {bank.questionCount} câu
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-on-surface-variant line-clamp-2">
                      {bank.description?.trim() || 'Chưa có mô tả cho ngân hàng này.'}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                        bank.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {bank.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(bank.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Filter bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="flex items-center gap-3 mb-5 flex-wrap"
          >
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Lọc:</span>
            </div>

            <div className="relative">
              <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[240px]"
              >
                <option value="">Tất cả question bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCourseFilter(''); setChapterFilter(''); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
              >
                <option value="">Tất cả môn</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setCourseFilter(''); setChapterFilter(''); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Tất cả lớp</option>
                {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Khóa học */}
            <div className="relative">
              <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
              >
                <option value="">Tất cả khóa học</option>
                {courses.map(c => <option key={c.id} value={c.id}>{truncate(c.title, 30)}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Chương (chỉ hiện khi đã chọn khóa học) */}
            {courseFilter && (
              <div className="relative">
                <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
                >
                  <option value="">Tất cả chương</option>
                  {allChapters.map(ch => <option key={ch.id} value={ch.id}>{truncate(ch.title, 30)}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            )}

            {/* Độ khó */}
            <div className="relative">
              <select value={diffFilter} onChange={e => setDiffFilter(e.target.value as Difficulty | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                {DIFFICULTY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as BankQuestionType | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[220px]"
              >
                {QUESTION_TYPE_FILTER_OPTS.map(option => (
                  <option key={option.value} value={option.value}>
                    {questionTypeFilterLabel(option.value, option.label)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Trạng thái */}
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as QuestionStatus | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {hasFilter && (
              <button
                onClick={() => { setDiffFilter('all'); setStatusFilter('all'); setTypeFilter('all'); setBankFilter(''); setCategoryFilter(''); setGradeFilter(''); setCourseFilter(''); setChapterFilter(''); }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </motion.div>

          {/* Cảnh báo khi ngân hàng vượt giới hạn fetch để giáo viên thu hẹp bằng bộ lọc. */}
          {!loadingQ && totalItems > QUESTION_FETCH_LIMIT && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-700">
              <span className="font-bold whitespace-nowrap">Lưu ý:</span>
              <span>
                Ngân hàng có <strong>{totalItems}</strong> câu hỏi nhưng chỉ hiển thị{' '}
                <strong>{QUESTION_FETCH_LIMIT}</strong> câu đầu tiên.
                Dùng bộ lọc Khóa học / Chương để thu hẹp kết quả và xem đầy đủ.
              </span>
            </div>
          )}

          {/* Loading */}
          {loadingQ && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <svg className="animate-spin w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-on-surface-variant font-medium">Đang tải ngân hàng câu hỏi...</p>
            </div>
          )}

          {/* Bảng câu hỏi */}
          {!loadingQ && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
            >
              {filteredQuestions.length === 0 ? (
                <div className="py-20 text-center">
                  <Database className="w-14 h-14 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant font-medium text-lg">Chưa có câu hỏi nào</p>
                  <p className="text-on-surface-variant/70 text-sm mt-1 mb-5">
                    {hasFilter ? 'Không có câu hỏi khớp bộ lọc hiện tại' : 'Thêm câu hỏi để cấu hình quiz cho từng chương'}
                  </p>
                  {!hasFilter && (
                    <button onClick={openAdd}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                    >
                      <Plus className="w-4 h-4" /> Thêm câu hỏi đầu tiên
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                        <th className="text-center px-4 py-3 w-12">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            aria-label="Chọn tất cả câu hỏi"
                            className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                          />
                        </th>
                        <th className="text-left px-5 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide w-[32%]">Nội dung câu hỏi</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Loại câu hỏi</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Độ khó</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Chương</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Môn</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden xl:table-cell">Question bank</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Dùng</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày tạo</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredQuestions.map((q, idx) => (
                          <motion.tr key={q.id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.025 }}
                            className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                              selectedIds.includes(q.id) ? 'bg-primary/5' : (idx % 2 !== 0 ? 'bg-surface-container/15' : '')
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(q.id)}
                                onChange={() => toggleSelectQuestion(q.id)}
                                aria-label={`Chọn câu hỏi ${idx + 1}`}
                                className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-on-surface font-medium leading-snug">{truncate(q.content, 100)}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {[
                                  q.choices.length > 0 ? `${q.choices.length} đáp án` : null,
                                  q.defaultPoints != null ? `${q.defaultPoints} điểm` : null,
                                  q.tags?.length ? q.tags.map(tag => `#${tag}`).join(' ') : null,
                                ].filter(Boolean).join(' · ')}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-on-surface">
                                {typeLabel(q.type, q.choices)}
                              </span>
                            </td>
                            <td className="px-4 py-3"><DifficultyBadge difficulty={q.difficulty} /></td>
                            <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell text-xs">
                              {q.chapterTitle ?? <span className="opacity-30">-</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {q.categoryName
                                ? <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{q.categoryName}</span>
                                : <span className="text-on-surface-variant/30 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell text-xs text-on-surface-variant">
                              {q.questionBankTitle
                                ? <span className="font-medium text-on-surface">{truncate(q.questionBankTitle, 28)}</span>
                                : <span className="opacity-30">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                              <span className={`font-bold text-sm ${q.usageCount > 0 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                                {q.usageCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant text-xs hidden lg:table-cell whitespace-nowrap">
                              {formatDate(q.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                q.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'
                              }`}>
                                {q.status === 'active' ? 'Đang dùng' : 'Tạm ẩn'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEdit(q)}
                                  className="px-2.5 py-1.5 text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                >
                                  Sửa
                                </button>
                                <button onClick={() => openHistory(q)}
                                  className="px-2.5 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                >
                                  Lịch sử
                                </button>
                                <button onClick={() => setDeleteTarget(q)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa câu hỏi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* Form Panel */}
      {panelOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <QuestionFormPanel
            open
            editing={editingQ}
            categories={categories}
            courses={courses}
            banks={banks}
            questions={questions}
            onClose={() => setPanelOpen(false)}
            onSaved={reloadPageData}
          />
        </Suspense>
      )}

      {bankDialogOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <QuestionBankCreateDialog
            open
            categories={categories}
            onClose={() => setBankDialogOpen(false)}
            onCreated={handleQuestionBankCreated}
          />
        </Suspense>
      )}

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        question={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <QuestionHistoryDialog
        question={historyTarget}
        versions={historyVersions}
        audits={historyAudits}
        loading={historyLoading}
        onClose={() => setHistoryTarget(null)}
      />

      <ConfirmBulkDeleteDialog
        count={bulkDeleteOpen ? selectedCount : 0}
        deleting={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {importOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ExcelImportModal
            open
            onClose={() => setImportOpen(false)}
            onImported={reloadPageData}
            selectedQuestionBank={selectedBank}
          />
        </Suspense>
      )}

      {aiScanOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <AIScanModal
            open
            onClose={() => setAiScanOpen(false)}
            onImported={reloadPageData}
            selectedQuestionBank={selectedBank}
          />
        </Suspense>
      )}
    </div>
  );
}
