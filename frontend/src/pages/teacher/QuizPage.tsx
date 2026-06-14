/**
 * TeacherQuizPage — Cấu hình quiz cho một chương (UC29)
 *
 * Lấy chapterId từ URL query param ?chapterId=...
 * Kết nối API thật qua quizService và questionService:
 *  - Lấy config hiện tại: quizService.getQuizConfig(chapterId)
 *  - Lấy thống kê câu hỏi: questionService.getQuestionStats(chapterId)
 *  - Lưu config: quizService.saveQuizConfig(chapterId, req)
 *
 * Validation: easyCount + mediumCount + hardCount phải bằng totalQuestions
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as quizService from '../../api/quizService';
import * as questionService from '../../api/questionService';
import type { QuizConfigRequest } from '../../api/quizService';
import type { QuestionStatsResponse } from '../../api/questionService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Save,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone, AlertTriangle, CheckCircle2,
  Shuffle, Timer, Target, Layers, Database,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════

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
];

// ═══════════════════════════════════════════════════════════════════
//  FORM STATE — giá trị mặc định khi chưa có config
// ═══════════════════════════════════════════════════════════════════

interface QuizForm {
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  timeLimitMinutes: string; // string để input number empty dễ xử lý
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  maxAttempts: string;
}

const DEFAULT_FORM: QuizForm = {
  totalQuestions: 10,
  easyCount: 4,
  mediumCount: 4,
  hardCount: 2,
  timeLimitMinutes: '',
  passingScore: 6.0,
  shuffleQuestions: true,
  shuffleChoices: true,
  maxAttempts: '',
};

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function numInput(
  label: string,
  value: number,
  onChange: (v: number) => void,
  min = 0,
  max?: number,
  hint?: string,
) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
        {label}
        {hint && <span className="text-on-surface-variant/60 font-normal normal-case ml-2">{hint}</span>}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.max(min, Number(e.target.value)))}
        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
      />
    </label>
  );
}

function toggle(label: string, checked: boolean, onChange: (v: boolean) => void) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-primary' : 'bg-outline-variant'
        }`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherQuizPage() {
  const [form, setForm] = useState<QuizForm>(DEFAULT_FORM);
  const [stats, setStats] = useState<QuestionStatsResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // Lấy chapterId từ query param
  const searchParams = new URLSearchParams(location.search);
  const chapterId = searchParams.get('chapterId') ?? '';

  // ── Load config & stats khi có chapterId ────────────────────────
  useEffect(() => {
    if (!chapterId) return;

    // Load quiz config
    setLoadingConfig(true);
    quizService.getQuizConfig(chapterId)
      .then(config => {
        setForm({
          totalQuestions: config.totalQuestions,
          easyCount: config.easyCount,
          mediumCount: config.mediumCount,
          hardCount: config.hardCount,
          timeLimitMinutes: config.timeLimitMinutes?.toString() ?? '',
          passingScore: config.passingScore,
          shuffleQuestions: config.shuffleQuestions,
          shuffleChoices: config.shuffleChoices,
          maxAttempts: config.maxAttempts?.toString() ?? '',
        });
        setConfigLoaded(true);
      })
      .catch(() => {
        // 404 = chưa có config → dùng DEFAULT_FORM (không toast lỗi vì đây là trạng thái bình thường)
        setConfigLoaded(false);
      })
      .finally(() => setLoadingConfig(false));

    // Load thống kê câu hỏi để cảnh báo thiếu
    setLoadingStats(true);
    questionService.getQuestionStats(chapterId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [chapterId]);

  // ── Validation ─────────────────────────────────────────────────
  // Tổng easyCount + mediumCount + hardCount phải bằng totalQuestions
  const countSum = form.easyCount + form.mediumCount + form.hardCount;
  const isCountValid = countSum === form.totalQuestions;
  const isPassingValid = form.passingScore >= 0 && form.passingScore <= 10;

  // Cảnh báo thiếu câu hỏi so với nhu cầu
  const easyWarning = stats && stats.easyCount < form.easyCount;
  const mediumWarning = stats && stats.mediumCount < form.mediumCount;
  const hardWarning = stats && stats.hardCount < form.hardCount;
  const hasStatsWarning = easyWarning || mediumWarning || hardWarning;

  // ── Save config ────────────────────────────────────────────────
  async function handleSave() {
    if (!chapterId) {
      notify.error('Chưa chọn chương — thêm ?chapterId=... vào URL');
      return;
    }
    if (!isCountValid) {
      notify.error(`Tổng phân bổ (${countSum}) phải bằng tổng số câu (${form.totalQuestions})`);
      return;
    }
    if (!isPassingValid) {
      notify.error('Điểm đạt phải từ 0 đến 10');
      return;
    }

    const req: QuizConfigRequest = {
      totalQuestions: form.totalQuestions,
      easyCount: form.easyCount,
      mediumCount: form.mediumCount,
      hardCount: form.hardCount,
      timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : undefined,
      passingScore: form.passingScore,
      shuffleQuestions: form.shuffleQuestions,
      shuffleChoices: form.shuffleChoices,
      maxAttempts: form.maxAttempts ? Number(form.maxAttempts) : undefined,
    };

    setSaving(true);
    try {
      await quizService.saveQuizConfig(chapterId, req);
      notify.success('Đã lưu cấu hình quiz');
      setConfigLoaded(true);
    } catch {
      notify.error('Không lưu được cấu hình quiz');
    } finally {
      setSaving(false);
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
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
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

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Cấu hình Quiz</h1>

          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar"
                className="w-9 h-9 rounded-full border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto max-w-3xl">

          {/* Heading */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold text-on-surface">Cấu hình Quiz chương</h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              {chapterId
                ? <>Chương: <span className="font-bold text-on-surface font-mono text-xs bg-surface-container px-2 py-0.5 rounded">{chapterId}</span></>
                : <span className="text-red-500">Chưa có chapterId — thêm ?chapterId=... vào URL</span>
              }
            </p>
          </motion.div>

          {/* Thông báo đã có config */}
          {configLoaded && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mb-5 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl"
            >
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium">Đã tải config hiện tại — có thể chỉnh sửa và lưu lại.</p>
            </motion.div>
          )}

          {/* Loading */}
          {loadingConfig && (
            <div className="flex items-center gap-2 mb-5 text-on-surface-variant text-sm">
              <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Đang tải cấu hình...
            </div>
          )}

          {/* Cảnh báo thiếu câu hỏi */}
          {hasStatsWarning && !loadingStats && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 bg-red-500/5 border border-red-500/30 rounded-xl"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-600 mb-1">Cảnh báo: Ngân hàng câu hỏi không đủ</p>
                  <ul className="text-sm text-red-500/80 space-y-0.5">
                    {easyWarning && (
                      <li>• Câu dễ: cần <strong>{form.easyCount}</strong>, có <strong>{stats!.easyCount}</strong></li>
                    )}
                    {mediumWarning && (
                      <li>• Câu trung bình: cần <strong>{form.mediumCount}</strong>, có <strong>{stats!.mediumCount}</strong></li>
                    )}
                    {hardWarning && (
                      <li>• Câu khó: cần <strong>{form.hardCount}</strong>, có <strong>{stats!.hardCount}</strong></li>
                    )}
                  </ul>
                  <p className="text-xs text-red-500/70 mt-1.5">
                    Thêm câu vào ngân hàng câu hỏi hoặc giảm số câu mỗi mức độ.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats overview */}
          {stats && !loadingStats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { label: 'Tổng câu', value: stats.totalActive, color: 'text-primary' },
                { label: 'Câu dễ', value: stats.easyCount, color: 'text-green-600' },
                { label: 'Câu TB', value: stats.mediumCount, color: 'text-amber-600' },
                { label: 'Câu khó', value: stats.hardCount, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
          >
            <div className="space-y-6">

              {/* Section: Số câu hỏi */}
              <div>
                <h3 className="font-bold text-on-surface flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-primary" />
                  Số lượng câu hỏi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {numInput(
                    'Tổng số câu',
                    form.totalQuestions,
                    v => setForm(f => ({ ...f, totalQuestions: v })),
                    1, 100,
                  )}
                  {numInput(
                    'Câu dễ',
                    form.easyCount,
                    v => setForm(f => ({ ...f, easyCount: v })),
                    0, form.totalQuestions,
                  )}
                  {numInput(
                    'Câu trung bình',
                    form.mediumCount,
                    v => setForm(f => ({ ...f, mediumCount: v })),
                    0, form.totalQuestions,
                  )}
                  {numInput(
                    'Câu khó',
                    form.hardCount,
                    v => setForm(f => ({ ...f, hardCount: v })),
                    0, form.totalQuestions,
                  )}
                </div>

                {/* Validation indicator */}
                <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${
                  isCountValid ? 'text-green-600' : 'text-red-500'
                }`}>
                  {isCountValid
                    ? <><CheckCircle2 className="w-4 h-4" /> Phân bổ hợp lệ ({countSum} = {form.totalQuestions})</>
                    : <><AlertTriangle className="w-4 h-4" /> Tổng phân bổ ({countSum}) ≠ Tổng câu ({form.totalQuestions})</>
                  }
                </div>
              </div>

              {/* Section: Thời gian & điểm */}
              <div className="pt-4 border-t border-outline-variant/20">
                <h3 className="font-bold text-on-surface flex items-center gap-2 mb-4">
                  <Timer className="w-4 h-4 text-primary" />
                  Thời gian & Điểm đạt
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Thời hạn làm bài
                      <span className="text-on-surface-variant/60 font-normal normal-case ml-2">(phút, để trống = không giới hạn)</span>
                    </span>
                    <input
                      type="number"
                      value={form.timeLimitMinutes}
                      min={1}
                      placeholder="Không giới hạn"
                      onChange={e => setForm(f => ({ ...f, timeLimitMinutes: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Điểm đạt (0–10)
                    </span>
                    <input
                      type="number"
                      value={form.passingScore}
                      min={0}
                      max={10}
                      step={0.5}
                      onChange={e => setForm(f => ({ ...f, passingScore: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Số lần làm tối đa
                      <span className="text-on-surface-variant/60 font-normal normal-case ml-2">(để trống = không giới hạn)</span>
                    </span>
                    <input
                      type="number"
                      value={form.maxAttempts}
                      min={1}
                      placeholder="Không giới hạn"
                      onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
                    />
                  </label>
                </div>
              </div>

              {/* Section: Shuffle options */}
              <div className="pt-4 border-t border-outline-variant/20">
                <h3 className="font-bold text-on-surface flex items-center gap-2 mb-4">
                  <Shuffle className="w-4 h-4 text-primary" />
                  Trộn đề
                </h3>
                <div className="space-y-3">
                  {toggle(
                    'Trộn ngẫu nhiên thứ tự câu hỏi',
                    form.shuffleQuestions,
                    v => setForm(f => ({ ...f, shuffleQuestions: v })),
                  )}
                  {toggle(
                    'Trộn ngẫu nhiên thứ tự đáp án',
                    form.shuffleChoices,
                    v => setForm(f => ({ ...f, shuffleChoices: v })),
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
                {!isCountValid && (
                  <span className="text-xs text-red-500 font-medium mr-auto">
                    Cần sửa phân bổ câu trước khi lưu
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !chapterId || !isCountValid}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Lưu cấu hình
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Ghi chú */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-5 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
          >
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <span className="font-bold text-blue-600">Lưu ý:</span>{' '}
              Quiz sẽ rút ngẫu nhiên từ ngân hàng câu hỏi của chương theo đúng tỷ lệ dễ/trung bình/khó đã cấu hình.
              Đảm bảo ngân hàng có đủ câu trước khi học sinh bắt đầu làm bài.
            </p>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
