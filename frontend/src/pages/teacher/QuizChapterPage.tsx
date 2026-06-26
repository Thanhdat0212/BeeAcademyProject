import TeacherNotificationBell from '../../components/TeacherNotificationBell';
/**
 * QuizChapterPage — /teacher/quiz
 * GV chọn khóa học → chọn chương → cấu hình quiz
 *
 * 2 chế độ:
 *   - Ngẫu nhiên: chọn số câu theo độ khó, hệ thống random từ ngân hàng
 *   - Tùy chọn:  tick chọn câu hỏi cụ thể từ ngân hàng
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { listMyCourses, getCourseDetail } from '../../api/teacherCourseService';
import type { TeacherCourseResponse, TeacherChapterResponse } from '../../api/teacherCourseService';
import * as quizService from '../../api/quizService';
import type { QuizConfigResponse } from '../../api/quizService';
import * as questionService from '../../api/questionService';
import type { QuestionResponse } from '../../api/questionService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Save, Loader2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone, Database, CheckCircle2,
  ChevronDown, Shuffle, Timer, AlertTriangle,
  Circle, ListChecks, Zap, TrendingUp, Minus, UserCircle, Lock,
} from 'lucide-react';

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher'           },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses'   },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content'   },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz'      },
  { icon: Database,        label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam'      },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades'    },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa'        },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints'},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue'   },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank'      },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile'   },
  { icon: Lock,            label: 'Tài khoản',           path: '/teacher/account'   },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChapterWithQuiz extends TeacherChapterResponse {
  quizConfig?: QuizConfigResponse | null; // undefined = chưa load, null = không có
}

interface RandomForm {
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  timeLimitMinutes: string;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  maxAttempts: string;
}

const DEFAULT_RANDOM: RandomForm = {
  totalQuestions: 10, easyCount: 4, mediumCount: 4, hardCount: 2,
  timeLimitMinutes: '', passingScore: 6.0,
  shuffleQuestions: true, shuffleChoices: true, maxAttempts: '',
};

// ─── Small components ─────────────────────────────────────────────────────────

function DiffBadge({ d }: { d: 'easy' | 'medium' | 'hard' }) {
  const cfg = {
    easy:   { cls: 'bg-green-100 text-green-700', label: 'Dễ',    icon: <Minus className="w-3 h-3" /> },
    medium: { cls: 'bg-amber-100 text-amber-700', label: 'TB',    icon: <TrendingUp className="w-3 h-3" /> },
    hard:   { cls: 'bg-red-100 text-red-700',     label: 'Khó',   icon: <Zap className="w-3 h-3" /> },
  };
  const { cls, label, icon } = cfg[d];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {icon}{label}
    </span>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <button
        type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-outline-variant'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function QuizChapterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout   = useAuthStore(s => s.logout);
  const user     = useAuthStore(s => s.user);

  // ── Data ──────────────────────────────────────────────────────────
  const [courses,        setCourses]        = useState<TeacherCourseResponse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [chapters,       setChapters]       = useState<ChapterWithQuiz[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterWithQuiz | null>(null);

  // ── Loading ───────────────────────────────────────────────────────
  const [loadingCourses,  setLoadingCourses]  = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [saving,          setSaving]          = useState(false);

  // ── Quiz mode & form ──────────────────────────────────────────────
  const [mode,        setMode]        = useState<'random' | 'manual'>('random');
  const [randomForm,  setRandomForm]  = useState<RandomForm>(DEFAULT_RANDOM);

  // Manual mode: questions from bank + selected IDs
  const [bankQuestions,  setBankQuestions]  = useState<QuestionResponse[]>([]);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [loadingBank,    setLoadingBank]    = useState(false);
  const [bankFilter,     setBankFilter]     = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  // ── Sidebar ───────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Load courses on mount ─────────────────────────────────────────
  useEffect(() => {
    listMyCourses(0, 100)
      .then(p => {
        setCourses(p.items);
        if (p.items.length > 0) setSelectedCourse(p.items[0].id);
      })
      .catch(() => notify.error('Không tải được danh sách khóa học'))
      .finally(() => setLoadingCourses(false));
  }, []);

  // ── Load chapters when course changes ─────────────────────────────
  useEffect(() => {
    if (!selectedCourse) return;
    setLoadingChapters(true);
    setChapters([]);
    setSelectedChapter(null);

    getCourseDetail(selectedCourse)
      .then(detail => {
        // Load quiz config cho từng chương song song
        const base: ChapterWithQuiz[] = detail.chapters.map(ch => ({ ...ch, quizConfig: undefined }));
        setChapters(base);

        Promise.all(
          detail.chapters.map(ch =>
            quizService.getQuizConfig(ch.id)
              .then(cfg => ({ id: ch.id, cfg }))
              .catch(() => ({ id: ch.id, cfg: null }))
          )
        ).then(results => {
          setChapters(prev => prev.map(ch => {
            const found = results.find(r => r.id === ch.id);
            return found ? { ...ch, quizConfig: found.cfg } : ch;
          }));
        });
      })
      .catch(() => notify.error('Không tải được danh sách chương'))
      .finally(() => setLoadingChapters(false));
  }, [selectedCourse]);

  // ── Select chapter → load config + bank ───────────────────────────
  const selectChapter = useCallback(async (ch: ChapterWithQuiz) => {
    setSelectedChapter(ch);
    setSelectedIds(new Set());
    setBankFilter('all');

    // Điền form từ config hiện có (nếu có)
    if (ch.quizConfig) {
      const c = ch.quizConfig;
      const m = (c.selectionMode ?? 'random') as 'random' | 'manual';
      setMode(m);
      setRandomForm({
        totalQuestions:   c.totalQuestions,
        easyCount:        c.easyCount,
        mediumCount:      c.mediumCount,
        hardCount:        c.hardCount,
        timeLimitMinutes: c.timeLimitMinutes?.toString() ?? '',
        passingScore:     c.passingScore,
        shuffleQuestions: c.shuffleQuestions,
        shuffleChoices:   c.shuffleChoices,
        maxAttempts:      c.maxAttempts?.toString() ?? '',
      });
      if (m === 'manual' && c.selectedQuestionIds) {
        setSelectedIds(new Set(c.selectedQuestionIds));
      }
    } else {
      setMode('random');
      setRandomForm(DEFAULT_RANDOM);
    }

    // Load ngân hàng câu hỏi cho chương này
    setLoadingBank(true);
    try {
      const page = await questionService.listQuestions({ chapterId: ch.id, size: 200 });
      setBankQuestions(page.items);
    } catch {
      notify.error('Không tải được ngân hàng câu hỏi');
    } finally {
      setLoadingBank(false);
    }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedChapter) return;

    const req: quizService.QuizConfigRequest = {
      totalQuestions:   randomForm.totalQuestions,
      easyCount:        randomForm.easyCount,
      mediumCount:      randomForm.mediumCount,
      hardCount:        randomForm.hardCount,
      timeLimitMinutes: randomForm.timeLimitMinutes ? Number(randomForm.timeLimitMinutes) : undefined,
      passingScore:     randomForm.passingScore,
      shuffleQuestions: randomForm.shuffleQuestions,
      shuffleChoices:   randomForm.shuffleChoices,
      maxAttempts:      randomForm.maxAttempts ? Number(randomForm.maxAttempts) : undefined,
      selectionMode:    mode,
      selectedQuestionIds: mode === 'manual' ? Array.from(selectedIds) : undefined,
    };

    if (mode === 'random') {
      const sum = randomForm.easyCount + randomForm.mediumCount + randomForm.hardCount;
      if (sum !== randomForm.totalQuestions) {
        notify.error(`Tổng phân bổ (${sum}) ≠ tổng câu (${randomForm.totalQuestions})`);
        return;
      }
    } else {
      if (selectedIds.size === 0) {
        notify.error('Chọn ít nhất 1 câu hỏi');
        return;
      }
    }

    setSaving(true);
    try {
      const saved = await quizService.saveQuizConfig(selectedChapter.id, req);
      notify.success('Đã lưu cấu hình quiz');
      // Cập nhật lại danh sách chương
      setChapters(prev => prev.map(ch =>
        ch.id === selectedChapter.id ? { ...ch, quizConfig: saved } : ch
      ));
      setSelectedChapter(prev => prev ? { ...prev, quizConfig: saved } : prev);
    } catch {
      notify.error('Không lưu được cấu hình quiz');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // ── Derived ───────────────────────────────────────────────────────
  const countSum   = randomForm.easyCount + randomForm.mediumCount + randomForm.hardCount;
  const countValid = countSum === randomForm.totalQuestions;
  const stats = {
    easy:   bankQuestions.filter(q => q.difficulty === 'easy').length,
    medium: bankQuestions.filter(q => q.difficulty === 'medium').length,
    hard:   bankQuestions.filter(q => q.difficulty === 'hard').length,
    total:  bankQuestions.length,
  };
  const filteredBank = bankFilter === 'all'
    ? bankQuestions
    : bankQuestions.filter(q => q.difficulty === bankFilter);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex font-sans">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex`}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg">B</div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />{item.label}
                {active && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline-variant/20">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"><Menu className="w-5 h-5" /></button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Quiz chương</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`} alt="avatar" className="w-9 h-9 rounded-full object-cover border-2 border-primary/30" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Title */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <h2 className="text-2xl font-extrabold text-on-surface">Quiz cuối chương</h2>
            <p className="text-on-surface-variant text-sm mt-1">Mỗi chương có 1 quiz. Cấu hình số câu và chế độ chọn câu từ ngân hàng.</p>
          </motion.div>

          {/* Course selector */}
          <div className="mb-5 relative max-w-sm">
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              disabled={loadingCourses}
              className="w-full appearance-none pl-4 pr-10 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-semibold text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
            >
              {loadingCourses
                ? <option>Đang tải...</option>
                : courses.length === 0
                  ? <option>Chưa có khóa học nào</option>
                  : courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
              }
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          </div>

          {/* Grid: chapters list + config panel */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* LEFT — Chapter list */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Danh sách chương
              </h3>

              {loadingChapters ? (
                <div className="flex items-center gap-2 py-8 justify-center text-on-surface-variant text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
                </div>
              ) : chapters.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">Khóa học chưa có chương nào</p>
              ) : (
                <div className="space-y-2">
                  {chapters.map(ch => {
                    const isSelected = selectedChapter?.id === ch.id;
                    const hasQuiz    = ch.quizConfig !== undefined && ch.quizConfig !== null;
                    const loading    = ch.quizConfig === undefined;
                    const isManual   = ch.quizConfig?.selectionMode === 'manual';

                    return (
                      <button key={ch.id} onClick={() => selectChapter(ch)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'}`}
                      >
                        <p className={`font-bold text-sm mb-1 line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{ch.title}</p>
                        {loading ? (
                          <p className="text-xs text-on-surface-variant/50 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Đang kiểm tra...</p>
                        ) : hasQuiz ? (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {isManual
                              ? `Tùy chọn · ${ch.quizConfig!.selectedQuestionIds?.length ?? 0} câu`
                              : `Ngẫu nhiên · ${ch.quizConfig!.totalQuestions} câu`
                            }
                            {ch.quizConfig!.timeLimitMinutes && ` · ${ch.quizConfig!.timeLimitMinutes} phút`}
                          </p>
                        ) : (
                          <p className="text-xs text-on-surface-variant flex items-center gap-1"><Circle className="w-3 h-3" /> Chưa có quiz</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* RIGHT — Config panel */}
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden"
            >
              {!selectedChapter ? (
                <div className="text-center py-20">
                  <PenSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">Chọn 1 chương bên trái để cấu hình quiz</p>
                </div>
              ) : (
                <>
                  {/* Chapter header */}
                  <div className="px-5 pt-5 pb-4 border-b border-outline-variant/20">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Chương đang cấu hình</p>
                    <h3 className="font-extrabold text-on-surface text-lg">{selectedChapter.title}</h3>
                    {/* Stats ngân hàng */}
                    {!loadingBank && bankQuestions.length > 0 && (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-on-surface-variant">Ngân hàng:</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{stats.easy} dễ</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{stats.medium} TB</span>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{stats.hard} khó</span>
                        <span className="text-xs text-on-surface-variant">= {stats.total} câu active</span>
                      </div>
                    )}
                    {!loadingBank && bankQuestions.length === 0 && (
                      <div className="flex items-center gap-2 mt-2 text-amber-600 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Ngân hàng chưa có câu hỏi cho chương này —{' '}
                        <Link to="/teacher/questions" className="underline font-semibold">thêm câu hỏi</Link>
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-5">

                    {/* Mode tabs */}
                    <div>
                      <p className="text-sm font-bold text-on-surface mb-2">Chế độ chọn câu hỏi</p>
                      <div className="flex rounded-xl overflow-hidden border border-outline-variant">
                        <button
                          type="button" onClick={() => setMode('random')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${mode === 'random' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                          <Shuffle className="w-4 h-4" /> Ngẫu nhiên
                        </button>
                        <button
                          type="button" onClick={() => setMode('manual')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                          <ListChecks className="w-4 h-4" /> Tùy chọn
                        </button>
                      </div>
                    </div>

                    {/* ── RANDOM MODE ── */}
                    {mode === 'random' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {([
                            ['Tổng câu', 'totalQuestions', 1, 100],
                            ['Câu dễ',   'easyCount',      0, 50 ],
                            ['Câu TB',   'mediumCount',    0, 50 ],
                            ['Câu khó',  'hardCount',      0, 50 ],
                          ] as const).map(([label, key, min, max]) => (
                            <label key={key} className="block">
                              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">{label}</span>
                              <input
                                type="number" min={min} max={max}
                                value={randomForm[key]}
                                onChange={e => setRandomForm(f => ({ ...f, [key]: Math.max(min, Number(e.target.value)) }))}
                                className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                              />
                            </label>
                          ))}
                        </div>

                        <div className={`flex items-center gap-2 text-sm font-medium ${countValid ? 'text-green-600' : 'text-red-500'}`}>
                          {countValid
                            ? <><CheckCircle2 className="w-4 h-4" /> Phân bổ hợp lệ ({countSum} = {randomForm.totalQuestions})</>
                            : <><AlertTriangle className="w-4 h-4" /> Tổng ({countSum}) ≠ tổng câu ({randomForm.totalQuestions})</>
                          }
                        </div>

                        {/* Stats cảnh báo thiếu */}
                        {bankQuestions.length > 0 && (
                          <div className="flex gap-2 flex-wrap text-xs">
                            {([['easy', randomForm.easyCount, stats.easy], ['medium', randomForm.mediumCount, stats.medium], ['hard', randomForm.hardCount, stats.hard]] as const).map(
                              ([d, need, have]) => need > have ? (
                                <span key={d} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-lg font-medium">
                                  <AlertTriangle className="w-3 h-3" /> {d === 'easy' ? 'Dễ' : d === 'medium' ? 'TB' : 'Khó'}: cần {need}, có {have}
                                </span>
                              ) : null
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Thời gian (phút)</span>
                            <input type="number" min={1} placeholder="Không giới hạn"
                              value={randomForm.timeLimitMinutes}
                              onChange={e => setRandomForm(f => ({ ...f, timeLimitMinutes: e.target.value }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Điểm đạt (0–10)</span>
                            <input type="number" min={0} max={10} step={0.5}
                              value={randomForm.passingScore}
                              onChange={e => setRandomForm(f => ({ ...f, passingScore: Number(e.target.value) }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Số lần tối đa</span>
                            <input type="number" min={1} placeholder="Không giới hạn"
                              value={randomForm.maxAttempts}
                              onChange={e => setRandomForm(f => ({ ...f, maxAttempts: e.target.value }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                            />
                          </label>
                        </div>

                        <div className="space-y-3 pt-1">
                          <Toggle label="Trộn ngẫu nhiên thứ tự câu hỏi" checked={randomForm.shuffleQuestions} onChange={v => setRandomForm(f => ({ ...f, shuffleQuestions: v }))} />
                          <Toggle label="Trộn ngẫu nhiên thứ tự đáp án" checked={randomForm.shuffleChoices}   onChange={v => setRandomForm(f => ({ ...f, shuffleChoices:   v }))} />
                        </div>
                      </div>
                    )}

                    {/* ── MANUAL MODE ── */}
                    {mode === 'manual' && (
                      <div className="space-y-3">
                        {/* Time + passing + attempts (dùng chung) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Thời gian (phút)</span>
                            <input type="number" min={1} placeholder="Không giới hạn"
                              value={randomForm.timeLimitMinutes}
                              onChange={e => setRandomForm(f => ({ ...f, timeLimitMinutes: e.target.value }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Điểm đạt (0–10)</span>
                            <input type="number" min={0} max={10} step={0.5}
                              value={randomForm.passingScore}
                              onChange={e => setRandomForm(f => ({ ...f, passingScore: Number(e.target.value) }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">Số lần tối đa</span>
                            <input type="number" min={1} placeholder="Không giới hạn"
                              value={randomForm.maxAttempts}
                              onChange={e => setRandomForm(f => ({ ...f, maxAttempts: e.target.value }))}
                              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                            />
                          </label>
                        </div>
                        <Toggle label="Trộn thứ tự câu hỏi" checked={randomForm.shuffleQuestions} onChange={v => setRandomForm(f => ({ ...f, shuffleQuestions: v }))} />
                        <Toggle label="Trộn thứ tự đáp án"   checked={randomForm.shuffleChoices}   onChange={v => setRandomForm(f => ({ ...f, shuffleChoices: v }))} />

                        {/* Question picker */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-on-surface">
                              Chọn câu hỏi{' '}
                              <span className="text-primary font-normal">({selectedIds.size} đã chọn)</span>
                            </p>
                            <div className="flex gap-1">
                              {(['all', 'easy', 'medium', 'hard'] as const).map(f => (
                                <button key={f} onClick={() => setBankFilter(f)}
                                  className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${bankFilter === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                                >
                                  {f === 'all' ? 'Tất cả' : f === 'easy' ? 'Dễ' : f === 'medium' ? 'TB' : 'Khó'}
                                </button>
                              ))}
                              {selectedIds.size > 0 && (
                                <button onClick={() => setSelectedIds(new Set())}
                                  className="px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  Bỏ chọn hết
                                </button>
                              )}
                            </div>
                          </div>

                          {loadingBank ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-on-surface-variant text-sm">
                              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải ngân hàng...
                            </div>
                          ) : filteredBank.length === 0 ? (
                            <div className="py-8 text-center border-2 border-dashed border-outline-variant/40 rounded-xl">
                              <p className="text-sm text-on-surface-variant">
                                {bankQuestions.length === 0
                                  ? 'Chưa có câu hỏi nào trong ngân hàng cho chương này'
                                  : 'Không có câu hỏi ở mức độ đã chọn'
                                }
                              </p>
                              {bankQuestions.length === 0 && (
                                <Link to="/teacher/questions" className="mt-2 inline-block text-sm font-bold text-primary hover:underline">
                                  → Thêm câu hỏi vào ngân hàng
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="border border-outline-variant/40 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                              {filteredBank.map(q => {
                                const checked = selectedIds.has(q.id);
                                return (
                                  <label key={q.id}
                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-outline-variant/10 last:border-0 transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-surface-container/30'}`}
                                  >
                                    <input type="checkbox" checked={checked}
                                      onChange={e => {
                                        const next = new Set(selectedIds);
                                        e.target.checked ? next.add(q.id) : next.delete(q.id);
                                        setSelectedIds(next);
                                      }}
                                      className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-on-surface font-medium line-clamp-2">{q.content}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <DiffBadge d={q.difficulty} />
                                        <span className="text-xs text-on-surface-variant">
                                          {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng/Sai'}
                                        </span>
                                        {q.usageCount > 0 && (
                                          <span className="text-xs text-on-surface-variant">· dùng {q.usageCount} lần</span>
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Save button */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/20">
                      <button onClick={() => setSelectedChapter(null)}
                        className="px-5 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors"
                      >
                        Đóng
                      </button>
                      <button onClick={handleSave} disabled={saving || (mode === 'random' && !countValid) || (mode === 'manual' && selectedIds.size === 0)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
