import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as questionService from '../../api/questionService';
import type {
  QuestionResponse, Difficulty, QuestionStatus, CreateQuestionRequest,
} from '../../api/questionService';
import { listCategories } from '../../api/courseService';
import { listMyCourses, getCourseDetail } from '../../api/teacherCourseService';
import type { TeacherCourseResponse, TeacherChapterResponse } from '../../api/teacherCourseService';
import type { Category } from '../../types/api';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone, RefreshCcw, Filter,
  ChevronDown, Zap, TrendingUp, Minus, Database,
  Save, Loader2, CheckCircle2, Circle, FileSpreadsheet, Sparkles, Lock,
} from 'lucide-react';
import ExcelImportModal from './ExcelImportModal';
import AIScanModal from './AIScanModal';

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher'            },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses'    },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content'    },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz'       },
  { icon: Database,        label: 'Ngân hàng câu hỏi', path: '/teacher/questions'  },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam'       },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades'     },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa'         },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints' },
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue'    },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank'       },
];

// ═══════════════════════════════════════════════════════════════════
//  HELPERS & SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const config = {
    easy:   { icon: <Minus className="w-3 h-3" />,     label: 'Dễ',         cls: 'bg-green-500/10 text-green-600' },
    medium: { icon: <TrendingUp className="w-3 h-3" />, label: 'Trung bình', cls: 'bg-amber-500/10 text-amber-600' },
    hard:   { icon: <Zap className="w-3 h-3" />,       label: 'Khó',        cls: 'bg-red-500/10 text-red-600'     },
  };
  const { icon, label, cls } = config[difficulty];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${cls}`}>
      {icon}{label}
    </span>
  );
}

function truncate(text: string, n: number) {
  return text.length <= n ? text : text.slice(0, n) + '…';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════
//  QUESTION FORM PANEL
// ═══════════════════════════════════════════════════════════════════

interface ChoiceRow { content: string; isCorrect: boolean }

function emptyChoices(type: 'multiple_choice' | 'true_false'): ChoiceRow[] {
  if (type === 'true_false') return [
    { content: 'Đúng', isCorrect: true },
    { content: 'Sai',  isCorrect: false },
  ];
  return [
    { content: '', isCorrect: true  },
    { content: '', isCorrect: false },
  ];
}

interface FormState {
  categoryId: string;
  grade: string;
  courseId: string;
  chapterId: string;
  content: string;
  explanation: string;
  difficulty: Difficulty;
  type: 'multiple_choice' | 'true_false';
  choices: ChoiceRow[];
}

function emptyForm(): FormState {
  return {
    categoryId: '', grade: '', courseId: '', chapterId: '',
    content: '', explanation: '',
    difficulty: 'medium', type: 'multiple_choice',
    choices: emptyChoices('multiple_choice'),
  };
}

function formFromQuestion(q: QuestionResponse): FormState {
  return {
    categoryId:  q.categoryId  ?? '',
    grade:       q.grade ? String(q.grade) : '',
    courseId:    '',
    chapterId:   q.chapterId   ?? '',
    content:     q.content,
    explanation: q.explanation ?? '',
    difficulty:  q.difficulty,
    type:        q.type,
    choices:     q.choices.map(c => ({ content: c.content, isCorrect: !!c.isCorrect })),
  };
}

interface QuestionFormPanelProps {
  open: boolean;
  editing: QuestionResponse | null;
  categories: Category[];
  courses: TeacherCourseResponse[];
  onClose: () => void;
  onSaved: () => void;
}

function QuestionFormPanel({ open, editing, categories, courses, onClose, onSaved }: QuestionFormPanelProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [chapters, setChapters] = useState<TeacherChapterResponse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form khi mở mới hoặc đổi câu hỏi đang sửa
  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFromQuestion(editing) : emptyForm());
    setChapters([]);
  }, [open, editing]);

  // Load chapters + lock category khi chọn course
  useEffect(() => {
    if (!form.courseId) { setChapters([]); return; }
    setLoadingChapters(true);
    getCourseDetail(form.courseId)
      .then(detail => {
        setChapters(detail.chapters);
        // Luôn auto-fill category từ course (bỏ điều kiện !editing cũ)
        // — đảm bảo categoryId luôn khớp với course đang chọn
        if (detail.categoryId) {
          setForm(f => ({
            ...f,
            categoryId: detail.categoryId!,
            grade: detail.grades?.[0] ? String(detail.grades[0]) : f.grade,
          }));
        }
      })
      .catch(() => notify.error('Không tải được danh sách chương'))
      .finally(() => setLoadingChapters(false));
  }, [form.courseId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleTypeChange(type: 'multiple_choice' | 'true_false') {
    setForm(f => ({ ...f, type, choices: emptyChoices(type) }));
  }

  function setChoiceCorrect(idx: number) {
    setForm(f => ({
      ...f,
      choices: f.choices.map((c, i) => ({ ...c, isCorrect: i === idx })),
    }));
  }

  function setChoiceContent(idx: number, value: string) {
    setForm(f => ({
      ...f,
      choices: f.choices.map((c, i) => i === idx ? { ...c, content: value } : c),
    }));
  }

  function addChoice() {
    setForm(f => ({
      ...f,
      choices: [...f.choices, { content: '', isCorrect: false }],
    }));
  }

  function removeChoice(idx: number) {
    setForm(f => {
      const choices = f.choices.filter((_, i) => i !== idx);
      // Nếu đáp án đúng bị xóa, đặt đáp án đầu tiên là đúng
      const hasCorrect = choices.some(c => c.isCorrect);
      if (!hasCorrect && choices.length > 0) choices[0].isCorrect = true;
      return { ...f, choices };
    });
  }

  async function handleSave() {
    if (!form.categoryId) { notify.error('Vui lòng chọn môn học'); return; }
    if (!form.grade) { notify.error('Vui lòng chọn lớp'); return; }
    if (!form.content.trim()) { notify.error('Vui lòng nhập nội dung câu hỏi'); return; }
    if (form.choices.some(c => !c.content.trim())) { notify.error('Vui lòng điền đầy đủ nội dung các đáp án'); return; }
    if (!form.choices.some(c => c.isCorrect)) { notify.error('Vui lòng chọn đáp án đúng'); return; }

    const req: CreateQuestionRequest = {
      categoryId:  form.categoryId,
      grade:       Number(form.grade),
      chapterId:   form.chapterId || undefined,
      content:     form.content.trim(),
      explanation: form.explanation.trim() || undefined,
      difficulty:  form.difficulty,
      type:        form.type,
      choices:     form.choices.map(c => ({ content: c.content.trim(), isCorrect: c.isCorrect })),
    };

    setSaving(true);
    try {
      if (editing) {
        await questionService.updateQuestion(editing.id, req);
        notify.success('Đã cập nhật câu hỏi');
      } else {
        await questionService.createQuestion(req);
        notify.success('Đã thêm câu hỏi vào ngân hàng');
      }
      onSaved();
      onClose();
    } catch {
      notify.error('Không lưu được câu hỏi');
    } finally {
      setSaving(false);
    }
  }

  const isCategoryLocked = Boolean(form.courseId);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-surface flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-shrink-0">
              <h2 className="font-extrabold text-on-surface text-lg">
                {editing ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Khóa học → Chương (ưu tiên chọn trước) */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Khóa học</label>
                  <div className="relative">
                    <select
                      value={form.courseId}
                      onChange={e => { set('courseId', e.target.value); set('chapterId', ''); }}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Không gắn --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{truncate(c.title, 40)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Chương</label>
                  <div className="relative">
                    <select
                      value={form.chapterId}
                      onChange={e => set('chapterId', e.target.value)}
                      disabled={!form.courseId || loadingChapters}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">-- Cấp môn học --</option>
                      {chapters.map(ch => <option key={ch.id} value={ch.id}>{truncate(ch.title, 40)}</option>)}
                    </select>
                    {loadingChapters
                      ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                      : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                    }
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lớp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.grade}
                      onChange={e => set('grade', e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Môn học — locked khi đã chọn course */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.categoryId}
                    onChange={e => set('categoryId', e.target.value)}
                    disabled={isCategoryLocked}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Chọn môn học --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {isCategoryLocked
                    ? <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                    : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  }
                </div>
                {isCategoryLocked && (
                  <p className="text-xs text-primary/70 mt-1">
                    Môn học được lấy từ khóa học đã chọn
                  </p>
                )}
              </div>
              {/* Loại câu hỏi */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Loại câu hỏi</label>
                <div className="flex rounded-xl overflow-hidden border border-outline-variant">
                  {(['multiple_choice', 'true_false'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                        form.type === t
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {t === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng / Sai'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nội dung câu hỏi */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Nội dung câu hỏi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => set('content', e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Độ khó */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Độ khó</label>
                <div className="flex gap-2">
                  {([['easy', 'Dễ', 'text-green-600 border-green-400 bg-green-50'],
                     ['medium', 'Trung bình', 'text-amber-600 border-amber-400 bg-amber-50'],
                     ['hard', 'Khó', 'text-red-600 border-red-400 bg-red-50']] as const).map(
                    ([val, label, activeCls]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => set('difficulty', val)}
                        className={`flex-1 py-2 text-sm font-bold rounded-xl border-2 transition-all ${
                          form.difficulty === val
                            ? activeCls
                            : 'border-outline-variant text-on-surface-variant bg-surface-container hover:bg-surface-container-high'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Đáp án */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Đáp án <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-on-surface-variant">
                    (click vòng tròn để chọn đáp án đúng)
                  </span>
                </label>
                <div className="space-y-2">
                  {form.choices.map((choice, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {/* Radio chọn đúng */}
                      <button
                        type="button"
                        onClick={() => setChoiceCorrect(idx)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          choice.isCorrect
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant text-transparent hover:border-primary/50'
                        }`}
                      >
                        {choice.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 opacity-0" />}
                      </button>

                      {/* Input nội dung */}
                      {form.type === 'true_false' ? (
                        <div className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border ${
                          choice.isCorrect ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant bg-surface-container text-on-surface-variant'
                        }`}>
                          {choice.content}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={choice.content}
                          onChange={e => setChoiceContent(idx, e.target.value)}
                          placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                        />
                      )}

                      {/* Nút xóa (chỉ khi multiple_choice và có > 2 đáp án) */}
                      {form.type === 'multiple_choice' && form.choices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeChoice(idx)}
                          className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Nút thêm đáp án */}
                {form.type === 'multiple_choice' && form.choices.length < 4 && (
                  <button
                    type="button"
                    onClick={addChoice}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm đáp án
                  </button>
                )}
              </div>

              {/* Giải thích */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Giải thích <span className="text-xs font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <textarea
                  value={form.explanation}
                  onChange={e => set('explanation', e.target.value)}
                  rows={3}
                  placeholder="Giải thích tại sao đáp án đó là đúng..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm vào ngân hàng')}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  CONFIRM DELETE DIALOG
// ═══════════════════════════════════════════════════════════════════

function ConfirmDeleteDialog({
  question, onConfirm, onCancel,
}: { question: QuestionResponse | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {question && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              "{truncate(question.content, 80)}"
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl">
                Hủy
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl">
                Xóa
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ConfirmBulkDeleteDialog({
  count, deleting, onConfirm, onCancel,
}: { count: number; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={deleting ? undefined : onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi đã chọn?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              Bạn đang chọn <span className="font-bold text-on-surface">{count}</span> câu hỏi. Thao tác này sẽ xóa hoặc tạm ẩn câu hỏi đã được dùng.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Đang xóa...' : 'Xóa tất cả'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

const DIFFICULTY_OPTS = [
  { value: 'all'   as const, label: 'Tất cả độ khó' },
  { value: 'easy'  as const, label: 'Dễ' },
  { value: 'medium'as const, label: 'Trung bình' },
  { value: 'hard'  as const, label: 'Khó' },
];

const STATUS_OPTS = [
  { value: 'all'     as const, label: 'Tất cả trạng thái' },
  { value: 'active'  as const, label: 'Đang dùng' },
  { value: 'inactive'as const, label: 'Tạm ẩn' },
];

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout  = useAuthStore(s => s.logout);
  const user    = useAuthStore(s => s.user);

  // ── Data ──────────────────────────────────────────────────────
  const [questions,   setQuestions]   = useState<QuestionResponse[]>([]);
  // totalItems: tổng số câu hỏi từ BE (bao gồm những câu ngoài giới hạn fetch).
  // Dùng để cảnh báo GV khi danh sách bị cắt (fetch size 200 < totalItems).
  const [totalItems,  setTotalItems]  = useState(0);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [courses,     setCourses]     = useState<TeacherCourseResponse[]>([]);
  const [allChapters, setAllChapters] = useState<TeacherChapterResponse[]>([]);

  // ── Loading ───────────────────────────────────────────────────
  const [loadingQ,    setLoadingQ]    = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // ── Filters ───────────────────────────────────────────────────
  const [diffFilter,    setDiffFilter]    = useState<Difficulty | 'all'>('all');
  const [statusFilter,  setStatusFilter]  = useState<QuestionStatus | 'all'>('all');
  const [categoryFilter,setCategoryFilter]= useState('');
  const [gradeFilter,   setGradeFilter]   = useState('');
  const [courseFilter,  setCourseFilter]  = useState('');
  const [chapterFilter, setChapterFilter] = useState('');

  // ── Panel / dialog state ──────────────────────────────────────
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [importOpen,     setImportOpen]     = useState(false);
  const [aiScanOpen,     setAiScanOpen]     = useState(false);
  const [editingQ,       setEditingQ]       = useState<QuestionResponse | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<QuestionResponse | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);

  // ── Load metadata (categories + courses) once ─────────────────
  // cancelled flag ngăn StrictMode double-invoke: lần mount đầu bị unmount trước
  // khi Promise.all xong → cancelled=true → setState bị bỏ qua → không spam toast.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCategories(),
      listMyCourses(0, 100).then(p => p.items),
    ])
      .then(([cats, crs]) => {
        if (cancelled) return;
        setCategories(cats);
        setCourses(crs);
      })
      .catch(() => { if (!cancelled) notify.error('Không tải được danh sách môn học / khóa học'); })
      .finally(() => { if (!cancelled) setLoadingMeta(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Load chapters khi chọn course filter ──────────────────────
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

  // Giới hạn fetch một lần — nếu ngân hàng vượt quá con số này thì hiện cảnh báo.
  const FETCH_LIMIT = 200;

  // refreshKey: tăng lên 1 để trigger reload thủ công (sau delete/save).
  // Tách riêng khỏi logic fetch để không tạo vòng lặp phụ thuộc.
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Load questions ────────────────────────────────────────────
  // Dùng useEffect với cleanup (cancelled flag) thay vì useCallback + useEffect.
  // Lý do: useCallback + useEffect(() => { fn() }, [fn]) vẫn double-fire trong
  // StrictMode vì cleanup chỉ cancel fn reference cũ, không cancel in-flight request.
  // cancelled flag đảm bảo chỉ lần mount cuối cùng (lần thứ 2 trong StrictMode)
  // mới setState và show toast — lần mount đầu bị cleanup trước khi Promise resolve.
  useEffect(() => {
    let cancelled = false;
    setLoadingQ(true);

    const params: questionService.ListQuestionsParams = { page: 0, size: FETCH_LIMIT };
    if (diffFilter    !== 'all') params.difficulty = diffFilter;
    if (statusFilter  !== 'all') params.status     = statusFilter;
    if (categoryFilter)          params.categoryId = categoryFilter;
    if (gradeFilter)             params.grade      = Number(gradeFilter);
    if (chapterFilter)           params.chapterId  = chapterFilter;

    questionService.listQuestions(params)
      .then(pageResult => {
        if (cancelled) return;
        const filteredItems = pageResult.items.filter(q => {
          if (categoryFilter && q.categoryId !== categoryFilter) return false;
          if (gradeFilter && q.grade !== Number(gradeFilter)) return false;
          if (chapterFilter && q.chapterId !== chapterFilter) return false;
          if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false;
          if (statusFilter !== 'all' && q.status !== statusFilter) return false;
          return true;
        });
        setQuestions(filteredItems);
        setSelectedIds(prev => prev.filter(id => filteredItems.some(q => q.id === id)));
        // Lưu tổng số thật từ BE để phát hiện trường hợp bị cắt ngầm
        setTotalItems(pageResult.totalItems);
      })
      .catch(() => { if (!cancelled) notify.error('Không tải được danh sách câu hỏi'); })
      .finally(() => { if (!cancelled) setLoadingQ(false); });

    return () => { cancelled = true; };
  }, [diffFilter, statusFilter, categoryFilter, gradeFilter, chapterFilter, refreshKey]);

  // Dùng useCallback để các event handler (delete, save) có thể gọi reload.
  // Không chứa logic fetch — chỉ trigger lại useEffect bên trên qua refreshKey.
  const loadQuestions = useCallback(() => setRefreshKey(k => k + 1), []);

  // ── Actions ───────────────────────────────────────────────────
  function openAdd()  { setEditingQ(null); setPanelOpen(true); }
  function openEdit(q: QuestionResponse) { setEditingQ(q); setPanelOpen(true); }

  const allQuestionIds = questions.map(q => q.id);
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
    loadQuestions();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await questionService.deleteQuestion(deleteTarget.id);
      notify.success('Đã xóa câu hỏi');
      setDeleteTarget(null);
      loadQuestions();
    } catch {
      notify.error('Không xóa được câu hỏi');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // ── Stats ──────────────────────────────────────────────────────
  const stats = {
    total:  questions.length,
    easy:   questions.filter(q => q.difficulty === 'easy').length,
    medium: questions.filter(q => q.difficulty === 'medium').length,
    hard:   questions.filter(q => q.difficulty === 'hard').length,
  };

  const hasFilter = diffFilter !== 'all' || statusFilter !== 'all' || categoryFilter || gradeFilter || courseFilter || chapterFilter;

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
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
            <button className="text-on-surface-variant hover:text-primary"><Bell className="w-5 h-5" /></button>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar" className="w-9 h-9 rounded-full border-2 border-primary/30"
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
                    {totalItems > FETCH_LIMIT ? `${stats.total}/${totalItems}` : stats.total}
                  </span> câu hỏi
                  {stats.total > 0 && (
                    <span className="ml-2 text-on-surface-variant/60">
                      · {stats.easy} dễ · {stats.medium} trung bình · {stats.hard} khó
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
              <button onClick={loadQuestions} disabled={loadingQ}
                className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                title="Làm mới"
              >
                <RefreshCcw className={`w-5 h-5 ${loadingQ ? 'animate-spin' : ''}`} />
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

          {/* Filter bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="flex items-center gap-3 mb-5 flex-wrap"
          >
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Lọc:</span>
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
                onClick={() => { setDiffFilter('all'); setStatusFilter('all'); setCategoryFilter(''); setGradeFilter(''); setCourseFilter(''); setChapterFilter(''); }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </motion.div>

          {/* Cảnh báo khi ngân hàng vượt giới hạn fetch — GV cần dùng filter để thu hẹp */}
          {!loadingQ && totalItems > FETCH_LIMIT && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-700">
              <span className="font-bold whitespace-nowrap">⚠ Lưu ý:</span>
              <span>
                Ngân hàng có <strong>{totalItems}</strong> câu hỏi nhưng chỉ hiển thị{' '}
                <strong>{FETCH_LIMIT}</strong> câu đầu tiên.
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
              {questions.length === 0 ? (
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
                        <th className="text-left px-5 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide w-[38%]">Nội dung câu hỏi</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Độ khó</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Chương</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Môn</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Dùng</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày tạo</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {questions.map((q, idx) => (
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
                                {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng / Sai'}
                                {q.choices.length > 0 && ` · ${q.choices.length} đáp án`}
                              </p>
                            </td>
                            <td className="px-4 py-3"><DifficultyBadge difficulty={q.difficulty} /></td>
                            <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell text-xs">
                              {q.chapterTitle ?? <span className="opacity-30">—</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {q.categoryName
                                ? <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{q.categoryName}</span>
                                : <span className="text-on-surface-variant/30 text-xs">—</span>}
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
      <QuestionFormPanel
        open={panelOpen}
        editing={editingQ}
        categories={categories}
        courses={courses}
        onClose={() => setPanelOpen(false)}
        onSaved={loadQuestions}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        question={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmBulkDeleteDialog
        count={bulkDeleteOpen ? selectedCount : 0}
        deleting={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadQuestions}
      />

      {/* AI Scan Modal */}
      <AIScanModal
        open={aiScanOpen}
        onClose={() => setAiScanOpen(false)}
        onImported={loadQuestions}
      />
    </div>
  );
}
