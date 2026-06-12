/**
 * TeacherExamPage — Trang "Bài kiểm tra" cho Giáo viên (UC30)
 *
 * Khác biệt cốt lõi so với Quiz chương (UC29):
 *   - Quiz:    gắn vào CUỐI MỖI CHƯƠNG       → mục đích củng cố
 *   - Exam:    gắn SAU MỖI 3 CHƯƠNG          → mục đích đánh giá giai đoạn
 *   - Học sinh: chỉ mở exam khi pass quiz 3 chương liên tiếp (UC17)
 *
 * Cấu trúc "slot":
 *   - Hệ thống tự chia số chương thành các slot 3 chương liên tiếp:
 *       6 chương → 2 slot  (slot 0 = ch 1-3, slot 1 = ch 4-6)
 *       7 chương → 2 slot  (slot 0 = ch 1-3, slot 1 = ch 4-6; ch 7 chưa đủ trọn 3)
 *   - Mỗi slot có DUY NHẤT 1 exam. GV chọn slot → tạo/sửa exam cho slot đó.
 *
 * Luồng chính:
 *   1. GV chọn khóa học
 *   2. Bên trái: danh sách slot (cố định bởi số chương)
 *   3. Click slot → form mở ở panel phải:
 *      - Slot đã có exam → load vào form
 *      - Slot chưa có → khởi tạo form rỗng
 *   4. Form 3 phần:
 *      a) Cài đặt chung: tên, mô tả, thời gian, điểm đạt
 *      b) Cài đặt làm bài: lần làm lại, xáo trộn, hiện đáp án
 *      c) Danh sách câu hỏi (có thêm trường "Mức độ khó")
 *   5. "Lưu bài kiểm tra" → commit; "Hủy" → đóng form không lưu
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { getCourseDetail, listMyCourses } from '../../api/teacherCourseService';
import type { TeacherCourseDetailResponse } from '../../api/teacherCourseService';
import * as examService from '../../api/examService';
import * as questionService from '../../api/questionService';
import type {
  ExamConfigRequest,
  ExamConfigResponse,
  ExamQuestionPayload,
} from '../../api/examService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Save, CheckCircle2, Circle,
  ChevronDown, ChevronRight, Shuffle, Eye, Repeat,
  Megaphone, Database, Loader2, AlertTriangle,
  Plus,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 2 loại câu hỏi (giống Quiz chương)
type QuestionType = 'single' | 'multiple';

// Mức độ khó của câu hỏi — đặc thù của Exam
// Lý do thêm: bài kiểm tra cần phân bố câu Dễ/TB/Khó hợp lý
// để đánh giá đúng năng lực HS, không phải tất cả cùng mức.
type Difficulty = 'easy' | 'medium' | 'hard';

interface ExamQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctIndices: number[];
  explanation?: string;
  points: number;
  difficulty: Difficulty;  // ← thêm so với Quiz
}

// Cài đặt 1 bài kiểm tra
interface Exam {
  name: string;
  description?: string;        // Hướng dẫn / mô tả cho HS đọc trước khi làm
  durationMinutes: number;
  passScorePercent: number;

  // ── Cài đặt làm bài (đặc thù Exam) ──
  maxAttempts: number;         // Số lần làm tối đa (vd 1, 2)
  shuffleQuestions: boolean;   // Xáo trộn thứ tự câu hỏi cho mỗi HS
  shuffleOptions: boolean;     // Xáo trộn thứ tự lựa chọn A/B/C/D
  showAnswerAfterSubmit: boolean; // Có cho HS xem đáp án sau khi nộp không

  questions: ExamQuestion[];
}

// Ref nhẹ đến chương — chỉ cần id/title/order để hiển thị
interface ChapterRef {
  id: string;
  title: string;
  order: number;
}

// 1 khóa học chứa nhiều chương + map exam theo slot
interface CourseInfo {
  id: string;
  title: string;
  chapters: ChapterRef[];
  // Dùng Record<slotIndex, Exam> thay vì array để dễ tra theo slot
  // (slot 0 → exams[0], slot 1 → exams[1]...)
  // Slot nào chưa có exam thì key đó không tồn tại.
  exams: Record<number, Exam>;
}

// Slot đã được tính từ chapters — không lưu trong state, derive khi render
interface ExamSlot {
  slotIndex: number;
  chapters: ChapterRef[];     // 3 chương thuộc slot
  exam?: Exam;                 // undefined = chưa tạo
}

interface ChapterRandomConfig {
  totalCount: number;
}

interface ChapterQuestionCount {
  totalActive: number;
}

function defaultChapterRandomConfig(totalCount = 10): ChapterRandomConfig {
  return {
    totalCount,
  };
}

function formatPoints(points: number): string {
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — NAV_ITEMS (đồng bộ sidebar teacher)
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
//  PHẦN 3 — HELPER: chia chương thành các slot 3 chương
// ═══════════════════════════════════════════════════════════════════
/**
 * computeSlots — Chia mảng chapters thành các slot 3 chương liên tiếp.
 * Quy tắc: chỉ tạo slot khi đủ 3 chương; chương dư cuối không tạo slot.
 *
 * Ví dụ:
 *   - 3 chương → [slot 0: ch 1-3]
 *   - 6 chương → [slot 0: ch 1-3, slot 1: ch 4-6]
 *   - 7 chương → [slot 0: ch 1-3, slot 1: ch 4-6] (ch 7 bị bỏ)
 */
function computeSlots(chapters: ChapterRef[], exams: Record<number, Exam>): ExamSlot[] {
  const slots: ExamSlot[] = [];
  // Chia làm các nhóm 3
  for (let i = 0; i + 3 <= chapters.length; i += 3) {
    const slotIndex = i / 3;
    slots.push({
      slotIndex,
      chapters: chapters.slice(i, i + 3),
      exam: exams[slotIndex],
    });
  }
  return slots;
}

function examFromResponse(response: ExamConfigResponse): Exam {
  return {
    name: response.name,
    description: response.description ?? '',
    durationMinutes: response.durationMinutes,
    passScorePercent: response.passScorePercent,
    maxAttempts: response.maxAttempts,
    shuffleQuestions: response.shuffleQuestions,
    shuffleOptions: response.shuffleOptions,
    showAnswerAfterSubmit: response.showAnswerAfterSubmit,
    questions: response.questions.map(questionFromPayload),
  };
}

function questionFromPayload(payload: ExamQuestionPayload): ExamQuestion {
  return {
    id: payload.id,
    text: payload.text,
    type: payload.type,
    options: [...payload.options],
    correctIndices: [...payload.correctIndices],
    explanation: payload.explanation ?? '',
    points: payload.points,
    difficulty: payload.difficulty,
  };
}

function examToRequest(exam: Exam): ExamConfigRequest {
  return {
    name: exam.name.trim(),
    description: exam.description?.trim() || null,
    durationMinutes: exam.durationMinutes,
    passScorePercent: exam.passScorePercent,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showAnswerAfterSubmit: exam.showAnswerAfterSubmit,
    questions: exam.questions.map(q => ({
      id: q.id,
      text: q.text.trim(),
      type: q.type,
      options: q.options.map(opt => opt.trim()),
      correctIndices: q.correctIndices,
      explanation: q.explanation?.trim() || null,
      points: q.points,
      difficulty: q.difficulty,
    })),
  };
}

function courseInfoFromDetail(
    detail: TeacherCourseDetailResponse,
    exams: ExamConfigResponse[],
): CourseInfo {
  return {
    id: detail.id,
    title: detail.title,
    chapters: detail.chapters
      .map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        order: chapter.position,
      }))
      .sort((a, b) => a.order - b.order),
    exams: exams.reduce<Record<number, Exam>>((acc, exam) => {
      acc[exam.slotIndex] = examFromResponse(exam);
      return acc;
    }, {}),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — SUB-COMPONENT: ExamQuestionCard
// ═══════════════════════════════════════════════════════════════════
/**
 * ExamQuestionCard — Card chứa 1 câu hỏi của bài kiểm tra.
 * Khác QuestionCard của Quiz: có thêm trường "Mức độ khó".
 * Tách thành component vì lặp lại N lần và có state gập/mở riêng.
 *
 * Props:
 *   - question: dữ liệu câu hỏi exam
 *   - index: thứ tự câu trong list (để label "Câu 1", "Câu 2"...)
 *   - onChange: callback khi user sửa bất kỳ field nào
 *   - onDelete: callback khi xóa câu hỏi
 */
interface ExamQuestionCardProps {
  question: ExamQuestion;
  index: number;
  onChange: (q: ExamQuestion) => void;
  onDelete: () => void;
}
function ExamQuestionCard({ question, index, onChange, onDelete }: ExamQuestionCardProps) {
  // Mặc định mở khi câu hỏi còn rỗng (mới tạo) để GV nhập luôn
  const [isExpanded, setIsExpanded] = useState(question.text === '');

  // Config màu sắc cho difficulty — gói lại để dễ tra trong JSX
  const difficultyConfig: Record<Difficulty, { label: string; className: string }> = {
    easy:   { label: 'Dễ',         className: 'bg-green-500/10 text-green-600'   },
    medium: { label: 'Trung bình', className: 'bg-amber-500/10 text-amber-600'   },
    hard:   { label: 'Khó',        className: 'bg-red-500/10 text-red-600'       },
  };

  // ── Thêm 1 lựa chọn rỗng ────────────────────────────────────
  function addOption() {
    onChange({ ...question, options: [...question.options, ''] });
  }

  // ── Sửa nội dung 1 option ───────────────────────────────────
  function updateOption(optionIdx: number, value: string) {
    onChange({
      ...question,
      options: question.options.map((opt, i) => i === optionIdx ? value : opt),
    });
  }

  // ── Xóa 1 option ───────────────────────────────────────────
  // Ràng buộc: phải còn ≥ 2 lựa chọn
  // Sau khi xóa, các correctIndices phải được điều chỉnh:
  //   - bỏ index vừa xóa
  //   - giảm các index lớn hơn xuống 1 (vì array thu nhỏ)
  function removeOption(optionIdx: number) {
    if (question.options.length <= 2) {
      notify.error('Câu hỏi phải có ít nhất 2 lựa chọn');
      return;
    }
    const newOptions = question.options.filter((_, i) => i !== optionIdx);
    const newCorrect = question.correctIndices
      .filter(i => i !== optionIdx)
      .map(i => i > optionIdx ? i - 1 : i);
    onChange({ ...question, options: newOptions, correctIndices: newCorrect });
  }

  // ── Toggle đáp án đúng ─────────────────────────────────────
  // single: chỉ giữ 1 index → set [optionIdx]
  // multiple: toggle thêm/bỏ index
  function toggleCorrect(optionIdx: number) {
    if (question.type === 'single') {
      onChange({ ...question, correctIndices: [optionIdx] });
    } else {
      const isCorrect = question.correctIndices.includes(optionIdx);
      const newCorrect = isCorrect
        ? question.correctIndices.filter(i => i !== optionIdx)
        : [...question.correctIndices, optionIdx];
      onChange({ ...question, correctIndices: newCorrect });
    }
  }

  // ── Đổi loại câu hỏi ───────────────────────────────────────
  // Multiple → single: chỉ giữ đáp án đúng đầu tiên
  function changeType(newType: QuestionType) {
    let newCorrect = question.correctIndices;
    if (newType === 'single' && question.correctIndices.length > 1) {
      newCorrect = [question.correctIndices[0]];
    }
    onChange({ ...question, type: newType, correctIndices: newCorrect });
  }

  return (
    <div className="border border-outline-variant/40 rounded-xl bg-surface-container/30 overflow-hidden">

      {/* Header card */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-container/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          <span className="font-bold text-on-surface text-sm flex-shrink-0">Câu {index + 1}</span>
          {!isExpanded && question.text && (
            <span className="text-sm text-on-surface-variant line-clamp-1">
              — {question.text}
            </span>
          )}
        </button>

        {/* Badge mức độ khó */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${difficultyConfig[question.difficulty].className}`}>
          {difficultyConfig[question.difficulty].label}
        </span>

        {/* Badge loại */}
        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
          {question.type === 'single' ? '1 đáp án' : 'Nhiều đáp án'}
        </span>

        <span className="text-xs font-bold text-on-surface-variant">{formatPoints(question.points)}đ</span>

        <button
          onClick={onDelete}
          title="Xóa câu hỏi"
          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Body — chỉ render khi mở */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">

              {/* Nội dung câu hỏi */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Nội dung câu hỏi <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={question.text}
                  onChange={e => onChange({ ...question, text: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                />
              </label>

              {/* Loại + Mức độ + Điểm (3 cột) */}
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Loại câu hỏi
                  </span>
                  <select
                    value={question.type}
                    onChange={e => changeType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="single">1 đáp án</option>
                    <option value="multiple">Nhiều đáp án</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Mức độ
                  </span>
                  <select
                    value={question.difficulty}
                    onChange={e => onChange({ ...question, difficulty: e.target.value as Difficulty })}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Điểm
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={question.points}
                    onChange={e => onChange({ ...question, points: parseFloat(e.target.value) || 0.01 })}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  />
                </label>
              </div>

              {/* Lựa chọn + Đáp án đúng */}
              <div>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Lựa chọn & đáp án đúng
                  <span className="text-on-surface-variant/70 font-normal normal-case ml-2">
                    (click vào ô tròn/vuông để chọn đáp án đúng)
                  </span>
                </span>
                <div className="space-y-2">
                  {question.options.map((opt, optIdx) => {
                    const isCorrect = question.correctIndices.includes(optIdx);
                    return (
                      <div key={optIdx} className="flex items-center gap-2">
                        {/* Nút chọn đáp án đúng — radio (single) hoặc checkbox (multiple) */}
                        <button
                          onClick={() => toggleCorrect(optIdx)}
                          title={isCorrect ? 'Đáp án đúng' : 'Click để chọn làm đáp án đúng'}
                          className={`flex-shrink-0 w-7 h-7 rounded-${question.type === 'single' ? 'full' : 'md'} flex items-center justify-center transition-colors ${
                            isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-surface-container-lowest border border-outline-variant hover:border-green-500'
                          }`}
                        >
                          {isCorrect
                            ? <CheckCircle2 className="w-4 h-4" />
                            : <Circle className="w-4 h-4 opacity-30" />}
                        </button>

                        <span className="text-sm font-bold text-on-surface-variant w-5 flex-shrink-0">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>

                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(optIdx, e.target.value)}
                          placeholder={`Lựa chọn ${String.fromCharCode(65 + optIdx)}`}
                          className="flex-1 px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                        />

                        {question.options.length > 2 && (
                          <button
                            onClick={() => removeOption(optIdx)}
                            title="Xóa lựa chọn"
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {question.options.length < 6 && (
                  <button
                    onClick={addOption}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm lựa chọn
                  </button>
                )}
              </div>

              {/* Giải thích (tùy chọn) */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Lời giải thích <span className="text-on-surface-variant/70 font-normal normal-case">(tùy chọn)</span>
                </span>
                <textarea
                  value={question.explanation ?? ''}
                  onChange={e => onChange({ ...question, explanation: e.target.value })}
                  placeholder="VD: Đáp án B vì..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherExamPage() {
  // ── State chính ─────────────────────────────────────────────────
  // data: nguồn sự thật về khóa/chương/exam đã commit
  const [data, setData] = useState<CourseInfo[]>([]);
  // Khóa đang chọn
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  // Slot đang chọn để chỉnh sửa (null = chưa chọn)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // form: bản copy của exam đang sửa.
  // Tách ra khỏi data để "Hủy" không ảnh hưởng — chỉ commit khi "Lưu".
  const [form, setForm] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [chapterRandomConfigs, setChapterRandomConfigs] =
    useState<Record<string, ChapterRandomConfig>>({});
  const [chapterStats, setChapterStats] =
    useState<Record<string, ChapterQuestionCount>>({});
  const [loadingChapterStats, setLoadingChapterStats] = useState(false);

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    let cancelled = false;

    async function loadCoursesAndExams() {
      setLoading(true);
      try {
        const page = await listMyCourses(0, 100);
        const courses = await Promise.all(
          page.items.map(async course => {
            const [detail, exams] = await Promise.all([
              getCourseDetail(course.id),
              examService.listCourseExams(course.id),
            ]);
            return courseInfoFromDetail(detail, exams);
          }),
        );

        if (cancelled) return;

        setData(courses);
        setSelectedCourseId(prev => {
          if (prev && courses.some(course => course.id === prev)) return prev;
          return courses[0]?.id ?? '';
        });
        setSelectedSlotIndex(null);
        setForm(null);
      } catch (error) {
        if (!cancelled) {
          setData([]);
          setSelectedCourseId('');
          notify.error(error instanceof Error
            ? error.message
            : 'Không tải được danh sách bài kiểm tra');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCoursesAndExams();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────
  const currentCourse = data.find(c => c.id === selectedCourseId);
  // Tính lại slots mỗi lần render — rẻ vì chỉ là chia mảng
  const slots = currentCourse ? computeSlots(currentCourse.chapters, currentCourse.exams) : [];
  const currentSlot = slots.find(s => s.slotIndex === selectedSlotIndex);

  // Tổng điểm — hiển thị để GV biết bài kiểm tra đáng bao nhiêu
  const totalPoints = form?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0;
  const activeChapterConfigs = currentSlot?.chapters.map(chapter => ({
    chapter,
    config: chapterRandomConfigs[chapter.id] ?? defaultChapterRandomConfig(),
    stats: chapterStats[chapter.id],
  })) ?? [];
  const chapterRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.totalCount, 0);
  const autoPointPerQuestion = chapterRandomTotal > 0 ? 10 / chapterRandomTotal : 0;
  const chapterRandomWarnings = activeChapterConfigs
    .filter(item => item.stats && item.config.totalCount > item.stats.totalActive)
    .map(item => ({
      key: item.chapter.id,
      chapterTitle: item.chapter.title,
      need: item.config.totalCount,
      have: item.stats!.totalActive,
    }));

  useEffect(() => {
    if (!currentSlot) {
      setChapterStats({});
      return;
    }

    let cancelled = false;
    setLoadingChapterStats(true);
    Promise.all(
      currentSlot.chapters.map(async chapter => {
        const totalActive = await questionService.countActiveQuestionsByChapter(chapter.id);
        return [chapter.id, { totalActive }] as const;
      }),
    )
      .then(entries => {
        if (!cancelled) {
          setChapterStats(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChapterStats({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChapterStats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, selectedSlotIndex]);

  // ── Handler: chọn slot để bắt đầu edit exam ──────────────────────
  function selectSlot(slot: ExamSlot) {
    setSelectedSlotIndex(slot.slotIndex);
    setChapterRandomConfigs(prev => {
      const next = { ...prev };
      slot.chapters.forEach(chapter => {
        if (!next[chapter.id]) {
          next[chapter.id] = defaultChapterRandomConfig();
        }
      });
      return next;
    });
    // Slot đã có exam → copy vào form để edit
    // Chưa có → khởi tạo exam rỗng với default hợp lý cho bài kiểm tra
    if (slot.exam) {
      setForm({
        ...slot.exam,
        questions: slot.exam.questions.map(q => ({ ...q })), // deep copy questions
      });
    } else {
      setForm({
        name: `Bài kiểm tra sau chương ${slot.chapters[slot.chapters.length - 1].order}`,
        description: '',
        durationMinutes: 45,    // Exam thường dài hơn quiz (45 vs 15)
        passScorePercent: 60,   // Exam thường khó hơn → ngưỡng pass thấp hơn
        maxAttempts: 1,         // Default 1 lần — exam chỉ làm 1 lần
        shuffleQuestions: true, // Default ON — chống gian lận
        shuffleOptions: true,   // Default ON — chống gian lận
        showAnswerAfterSubmit: false, // Default OFF — không lộ đề cho khóa sau
        questions: [],
      });
    }
  }

  // ── Handler: đổi khóa học ────────────────────────────────────────
  function changeCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedSlotIndex(null);
    setForm(null);
  }

  // ── Handler: thêm 1 câu hỏi mới vào form ─────────────────────────
  // Default difficulty = 'medium' vì là mức cân bằng nhất
  function addQuestion() {
    if (!form) return;
    const newQuestion: ExamQuestion = {
      id: `eq-${Date.now()}`,
      text: '',
      type: 'single',
      options: ['', ''],
      correctIndices: [],
      points: 1,
      difficulty: 'medium',
    };
    setForm({ ...form, questions: [...form.questions, newQuestion] });
  }

  // ── Handler: cập nhật 1 câu hỏi ─────────────────────────────────
  function updateQuestion(idx: number, updated: ExamQuestion) {
    if (!form) return;
    setForm({
      ...form,
      questions: form.questions.map((q, i) => i === idx ? updated : q),
    });
  }

  // ── Handler: xóa 1 câu hỏi ──────────────────────────────────────
  function deleteQuestion(idx: number) {
    if (!form) return;
    setForm({ ...form, questions: form.questions.filter((_, i) => i !== idx) });
  }

  function updateChapterRandomConfig(
      chapterId: string,
      key: keyof ChapterRandomConfig,
      value: number,
  ) {
    setChapterRandomConfigs(prev => {
      const current = prev[chapterId] ?? defaultChapterRandomConfig();
      const safeValue = Math.max(0, value);
      return {
        ...prev,
        [chapterId]: {
          ...current,
          [key]: safeValue,
        },
      };
    });
  }

  async function randomizeQuestionsFromBank() {
    if (!form || !selectedCourseId || !currentSlot || randomizing) return;
    if (chapterRandomTotal <= 0) {
      notify.error('Cần chọn ít nhất 1 câu hỏi để random');
      return;
    }
    if (chapterRandomWarnings.length > 0) {
      notify.error('Ngân hàng câu hỏi chưa đủ theo phân bổ đã chọn');
      return;
    }

    setRandomizing(true);
    try {
      const questions = await examService.randomizeCourseExamQuestions(
        selectedCourseId,
        {
          easyCount: 0,
          mediumCount: 0,
          hardCount: 0,
          pointsPerQuestion: autoPointPerQuestion,
          chapterConfigs: activeChapterConfigs.map(item => ({
            chapterId: item.chapter.id,
            totalCount: item.config.totalCount,
          })),
        },
      );
      setForm({
        ...form,
        questions: questions.map(questionFromPayload),
      });
      notify.success(`Đã random ${questions.length} câu từ ngân hàng câu hỏi`);
    } catch (error) {
      notify.error(error instanceof Error
        ? error.message
        : 'Không random được câu hỏi từ ngân hàng');
    } finally {
      setRandomizing(false);
    }
  }

  // ── Handler: lưu bài kiểm tra ───────────────────────────────────
  // Validate: tương tự quiz nhưng có thêm check maxAttempts
  async function saveExam() {
    if (!form || selectedSlotIndex === null || !selectedCourseId || saving) return;

    if (!form.name.trim()) {
      notify.error('Vui lòng nhập tên bài kiểm tra');
      return;
    }
    if (form.durationMinutes < 1) {
      notify.error('Thời gian làm bài phải >= 1 phút');
      return;
    }
    if (form.passScorePercent < 0 || form.passScorePercent > 100) {
      notify.error('Điểm đạt phải từ 0% đến 100%');
      return;
    }
    if (form.maxAttempts < 1) {
      notify.error('Số lần làm lại phải >= 1');
      return;
    }
    if (form.questions.length === 0) {
      notify.error('Bài kiểm tra phải có ít nhất 1 câu hỏi');
      return;
    }
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.text.trim()) {
        notify.error(`Câu ${i + 1}: chưa nhập nội dung`);
        return;
      }
      if (q.options.some(opt => !opt.trim())) {
        notify.error(`Câu ${i + 1}: có lựa chọn còn rỗng`);
        return;
      }
      if (q.correctIndices.length === 0) {
        notify.error(`Câu ${i + 1}: chưa chọn đáp án đúng`);
        return;
      }
    }

    setSaving(true);
    try {
      const saved = await examService.saveCourseExam(
        selectedCourseId,
        selectedSlotIndex,
        examToRequest(form),
      );
      const savedExam = examFromResponse(saved);

      setData(prev => prev.map(course => {
        if (course.id !== selectedCourseId) return course;
        return {
          ...course,
          exams: { ...course.exams, [selectedSlotIndex]: savedExam },
        };
      }));
      setForm({
        ...savedExam,
        questions: savedExam.questions.map(q => ({ ...q })),
      });
      notify.success('Đã lưu bài kiểm tra');
    } catch (error) {
      notify.error(error instanceof Error
        ? error.message
        : 'Không lưu được bài kiểm tra');
    } finally {
      setSaving(false);
    }
  }

  // ── Handler: hủy chỉnh sửa ──────────────────────────────────────
  function cancelEdit() {
    setSelectedSlotIndex(null);
    setForm(null);
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
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Bài kiểm tra</h1>
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

          {/* Tiêu đề + dropdown chọn khóa */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Bài kiểm tra giai đoạn</h2>
            <p className="text-on-surface-variant text-sm mb-4">
              Mỗi 3 chương có 1 bài kiểm tra. Học sinh chỉ mở được khi đã pass quiz 3 chương liên tiếp.
            </p>

            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-2 block">Chọn khóa học</span>
              <select
                value={selectedCourseId}
                onChange={e => changeCourse(e.target.value)}
                disabled={loading || data.length === 0}
                className="w-full max-w-md px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
              >
                {data.length === 0 && (
                  <option value="">
                    {loading ? 'Đang tải khóa học...' : 'Chưa có khóa học'}
                  </option>
                )}
                {data.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
          </motion.div>

          {/* Grid 2 cột: trái danh sách slot, phải form exam */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — Danh sách slot exam */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                Vị trí bài kiểm tra
              </h3>

              {slots.length === 0 ? (
                // Khóa < 3 chương → không có slot nào
                <p className="text-sm text-on-surface-variant text-center py-8">
                  {loading
                    ? 'Đang tải dữ liệu bài kiểm tra...'
                    : data.length === 0
                      ? 'Bạn chưa có khóa học nào để tạo bài kiểm tra.'
                      : 'Khóa học cần ít nhất 3 chương để có bài kiểm tra.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {slots.map(slot => {
                    const hasExam = !!slot.exam;
                    const isSelected = slot.slotIndex === selectedSlotIndex;
                    const lastChapterOrder = slot.chapters[slot.chapters.length - 1].order;

                    return (
                      <button
                        key={slot.slotIndex}
                        onClick={() => selectSlot(slot)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                          Bài kiểm tra sau chương {lastChapterOrder}
                        </p>
                        <p className="text-xs text-on-surface-variant mb-1.5 line-clamp-1">
                          {slot.chapters.map(ch => `Ch.${ch.order}`).join(' · ')}
                        </p>
                        {hasExam ? (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã tạo · {slot.exam!.questions.length} câu · {slot.exam!.durationMinutes} phút
                          </p>
                        ) : (
                          <p className="text-xs text-on-surface-variant flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            Chưa tạo — click để tạo
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — Form exam */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
            >
              {!form || !currentSlot ? (
                <div className="text-center py-16">
                  <GraduationCap className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    {loading
                      ? 'Đang tải dữ liệu bài kiểm tra...'
                      : data.length === 0
                        ? 'Bạn chưa có khóa học nào để tạo bài kiểm tra.'
                        : 'Chọn 1 vị trí ở bên trái để bắt đầu tạo/sửa bài kiểm tra'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Tiêu đề + phạm vi chương */}
                  <div className="mb-5 pb-4 border-b border-outline-variant/30">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">
                      Đang chỉnh sửa bài kiểm tra cho
                    </p>
                    <h3 className="font-extrabold text-on-surface text-lg mb-2">
                      Sau chương {currentSlot.chapters[currentSlot.chapters.length - 1].order}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {currentSlot.chapters.map(ch => (
                        <span key={ch.id} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          {ch.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ── PHẦN 1: Cài đặt chung ─────────────────────── */}
                  <div className="space-y-4 mb-6">
                    <p className="text-sm font-bold text-on-surface">Cài đặt chung</p>

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Tên bài kiểm tra <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="VD: Bài kiểm tra giữa kỳ I"
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                      />
                    </label>

                    {/* Mô tả/Hướng dẫn — đặc thù Exam */}
                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Mô tả / Hướng dẫn làm bài <span className="text-on-surface-variant/70 font-normal normal-case">(hiển thị trước khi HS bắt đầu)</span>
                      </span>
                      <textarea
                        value={form.description ?? ''}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="VD: Đọc kỹ đề trước khi làm. Không sử dụng tài liệu."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />
                    </label>

                    {/* Thời gian + Pass score + Tổng điểm (3 cột) */}
                    <div className="grid grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Thời gian (phút)
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={form.durationMinutes}
                          onChange={e => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Điểm đạt (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.passScorePercent}
                          onChange={e => setForm({ ...form, passScorePercent: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                      <div>
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Tổng điểm
                        </span>
                        <div className="w-full px-3 py-2 text-sm bg-surface-container/50 border border-outline-variant/50 rounded-lg text-on-surface font-bold">
                          {formatPoints(totalPoints)} điểm
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── PHẦN 2: Cài đặt làm bài (đặc thù Exam) ───── */}
                  <div className="space-y-3 mb-6 pt-4 border-t border-outline-variant/30">
                    <p className="text-sm font-bold text-on-surface">Cài đặt làm bài</p>

                    {/* Số lần làm lại */}
                    <label className="flex items-center gap-3">
                      <Repeat className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">Số lần làm tối đa</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={form.maxAttempts}
                        onChange={e => setForm({ ...form, maxAttempts: parseInt(e.target.value) || 1 })}
                        className="w-20 px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface text-center"
                      />
                    </label>

                    {/* Toggle: xáo trộn câu hỏi */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Shuffle className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Xáo trộn thứ tự câu hỏi
                        <span className="text-xs text-on-surface-variant/70 ml-2">(mỗi HS thấy thứ tự khác nhau)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.shuffleQuestions}
                        onChange={e => setForm({ ...form, shuffleQuestions: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    {/* Toggle: xáo trộn lựa chọn */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Shuffle className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Xáo trộn thứ tự lựa chọn A/B/C/D
                      </span>
                      <input
                        type="checkbox"
                        checked={form.shuffleOptions}
                        onChange={e => setForm({ ...form, shuffleOptions: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    {/* Toggle: hiện đáp án sau khi nộp */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Eye className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Hiển thị đáp án đúng sau khi nộp bài
                        <span className="text-xs text-on-surface-variant/70 ml-2">(tắt nếu không muốn lộ đề)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.showAnswerAfterSubmit}
                        onChange={e => setForm({ ...form, showAnswerAfterSubmit: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>
                  </div>

                  {/* ── PHẦN 3: Câu hỏi ─────────────────────────── */}
                  <div className="space-y-3 mb-6 pt-4 border-t border-outline-variant/30">
                    <p className="text-sm font-bold text-on-surface">
                      Câu hỏi <span className="text-on-surface-variant font-normal">({form.questions.length})</span>
                    </p>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <Shuffle className="w-4 h-4 text-primary" />
                            Random từ ngân hàng câu hỏi
                          </p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Mỗi chương sẽ được bốc ngẫu nhiên tự nhiên trong ngân hàng câu hỏi của chính chương đó, không lọc độ khó.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {activeChapterConfigs.map(({ chapter, config, stats }) => (
                          <div
                            key={chapter.id}
                            className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3 md:items-center">
                              <div>
                                <p className="text-sm font-bold text-on-surface">
                                  Ch.{chapter.order}: {chapter.title}
                                </p>
                                <p className="text-xs text-on-surface-variant mt-1">
                                  {loadingChapterStats ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Đang tải
                                    </span>
                                  ) : stats ? (
                                    <>Có {stats.totalActive} câu trong ngân hàng</>
                                  ) : (
                                    <>Chưa đọc được thống kê</>
                                  )}
                                </p>
                              </div>

                              <label className="block">
                                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                                  Số câu
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={config.totalCount}
                                  onChange={e => updateChapterRandomConfig(
                                    chapter.id,
                                    'totalCount',
                                    parseInt(e.target.value) || 0,
                                  )}
                                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs">
                          {chapterRandomWarnings.length > 0 ? (
                            <div className="text-red-600 font-medium flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              <span>
                                Thiếu {chapterRandomWarnings.map(item =>
                                  `${item.chapterTitle}: cần ${item.need}, có ${item.have}`,
                                ).join('; ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-on-surface-variant">
                              Sẽ random {chapterRandomTotal} câu từ {activeChapterConfigs.length} chương · {formatPoints(autoPointPerQuestion)} điểm/câu.
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={randomizeQuestionsFromBank}
                          disabled={randomizing || loadingChapterStats || chapterRandomTotal <= 0 || chapterRandomWarnings.length > 0}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {randomizing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shuffle className="w-4 h-4" />
                          )}
                          {randomizing ? 'Đang random...' : 'Random câu hỏi'}
                        </button>
                      </div>
                    </div>

                    {form.questions.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl">
                        <p className="text-sm text-on-surface-variant">
                          Chưa có câu hỏi nào. Hãy random từ ngân hàng câu hỏi ở phía trên.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.questions.map((q, idx) => (
                          <ExamQuestionCard
                            key={q.id}
                            question={q}
                            index={idx}
                            onChange={updated => updateQuestion(idx, updated)}
                            onDelete={() => deleteQuestion(idx)}
                          />
                        ))}
                      </div>
                    )}

                    <button
                      onClick={addQuestion}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-primary border-2 border-dashed border-primary/30 hover:bg-primary/5 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm câu hỏi thủ công
                    </button>
                  </div>

                  {/* Nút hành động */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/30">
                    <button
                      onClick={cancelEdit}
                      className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={saveExam}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Đang lưu...' : 'Lưu bài kiểm tra'}
                    </button>
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
