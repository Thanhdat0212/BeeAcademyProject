/**
 * TeacherQuizChapterPage — Trang "Quiz chương" cho Giáo viên (UC29)
 *
 * Vị trí quiz:
 *   - Mỗi CHƯƠNG có duy nhất 1 quiz, gắn vào CUỐI chương.
 *   - Quiz tự mở cho học sinh khi progress_chapter = 100% (UC16).
 *   - Khi học sinh pass quiz 3 chương liên tiếp → mở bài kiểm tra (UC17).
 *
 * Luồng chính:
 *   1. GV chọn khóa học (dropdown)
 *   2. Bên trái: danh sách chương — mỗi chương hiển thị "Đã có quiz" hoặc "Chưa có"
 *   3. Click chương → form mở ở panel phải:
 *      - Nếu chương đã có quiz → load quiz đó vào form
 *      - Nếu chưa có → form rỗng để tạo mới
 *   4. Form chia 2 phần:
 *      a) Cài đặt chung: Tên quiz, Thời gian, Điểm đạt (%)
 *      b) Danh sách câu hỏi: nội dung + loại + lựa chọn + đáp án + giải thích + điểm
 *   5. Nhấn "Lưu quiz" → commit form về state; "Hủy" → đóng form không lưu
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Save, CheckCircle2, Circle,
  ChevronDown, ChevronRight, Megaphone,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// 2 loại câu hỏi theo yêu cầu UC29
//   - 'single':   trắc nghiệm 1 đáp án đúng  (radio button)
//   - 'multiple': trắc nghiệm nhiều đáp án đúng (checkbox)
type QuestionType = 'single' | 'multiple';

interface Question {
  id: string;
  text: string;             // Nội dung câu hỏi
  type: QuestionType;
  options: string[];        // Các lựa chọn A, B, C, D... (tối thiểu 2)
  correctIndices: number[]; // Index các đáp án đúng. Dùng mảng cho CẢ 2 loại
                            // để code xử lý thống nhất:
                            //   - 'single' → mảng 1 phần tử   vd [1]
                            //   - 'multiple' → mảng 1+ phần tử vd [0, 2]
  explanation?: string;     // Lời giải thích (tùy chọn) — hiển thị cho HS sau khi nộp
  points: number;           // Điểm của câu hỏi này (mặc định 1)
}

// 1 chương có DUY NHẤT 1 quiz (gắn cuối chương theo UC29)
interface ChapterQuiz {
  name: string;             // Tên quiz, vd "Quiz cuối chương 1"
  durationMinutes: number;  // Thời gian làm bài (phút)
  passScorePercent: number; // Điểm đạt — TÍNH THEO % tổng điểm.
                            // Lý do dùng %: khi GV thêm/bớt câu hỏi,
                            // ngưỡng pass tự co giãn theo, không phải chỉnh tay.
  questions: Question[];
}

interface ChapterInfo {
  id: string;
  title: string;
  order: number;
  quiz?: ChapterQuiz;       // Có thể chưa có quiz
}

interface CourseInfo {
  id: string;
  title: string;
  chapters: ChapterInfo[];
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════
// 2 khóa, mỗi khóa vài chương — 1 chương đã có quiz để demo edit,
// 1 chương chưa có quiz để demo create.
const INITIAL_DATA: CourseInfo[] = [
  {
    id: 'c1',
    title: 'Toán Đại Số - Lớp 8',
    chapters: [
      {
        id: 'ch1', order: 1, title: 'Chương 1: Hằng đẳng thức',
        quiz: {
          name: 'Quiz Hằng đẳng thức',
          durationMinutes: 15,
          passScorePercent: 70,
          questions: [
            {
              id: 'q1',
              text: 'Hằng đẳng thức (a + b)² bằng biểu thức nào?',
              type: 'single',
              options: ['a² + b²', 'a² + 2ab + b²', 'a² − 2ab + b²', '2a² + 2b²'],
              correctIndices: [1],
              explanation: '(a + b)² = a² + 2ab + b² — bình phương của một tổng.',
              points: 5,
            },
            {
              id: 'q2',
              text: 'Chọn các biểu thức đúng:',
              type: 'multiple',
              options: ['(a − b)² = a² − 2ab + b²', '(a + b)(a − b) = a² − b²', 'a² − b² = (a − b)²'],
              correctIndices: [0, 1],
              points: 5,
            },
          ],
        },
      },
      {
        id: 'ch2', order: 2, title: 'Chương 2: Phân tích đa thức',
        // chương này CHƯA có quiz → demo flow tạo mới
      },
    ],
  },
  {
    id: 'c2',
    title: 'Vật Lý - Lớp 9',
    chapters: [
      { id: 'ch3', order: 1, title: 'Chương 1: Điện học' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — NAV_ITEMS (đồng bộ sidebar teacher)
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
//  PHẦN 4 — SUB-COMPONENT: QuestionCard
// ═══════════════════════════════════════════════════════════════════
/**
 * QuestionCard — Card chứa nội dung 1 câu hỏi với khả năng gập/mở.
 * Lý do tách thành component:
 *   - 1 quiz có thể có nhiều câu → card lặp lại, tránh duplicate JSX
 *   - Mỗi card tự quản lý isExpanded → không cần state ở component cha
 *
 * Props:
 *   - question: dữ liệu câu hỏi
 *   - index: vị trí trong list (dùng cho label "Câu 1", "Câu 2"...)
 *   - onChange: callback khi user sửa bất kỳ trường nào → trả về Question đã update
 *   - onDelete: callback khi xóa câu hỏi này
 */
interface QuestionCardProps {
  question: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
}
function QuestionCard({ question, index, onChange, onDelete }: QuestionCardProps) {
  // State gập/mở. Mặc định mở khi câu hỏi còn rỗng (vừa tạo) để GV nhập luôn.
  // Khi text đã có → có thể gập lại để xem tổng quan nhiều câu.
  const [isExpanded, setIsExpanded] = useState(question.text === '');

  // ── Helper: thêm 1 lựa chọn mới (option) rỗng ───────────────
  // Mặc định khởi tạo 2 lựa chọn khi tạo question; ở đây cho phép +
  function addOption() {
    onChange({ ...question, options: [...question.options, ''] });
  }

  // ── Helper: sửa nội dung 1 option theo index ────────────────
  function updateOption(optionIdx: number, value: string) {
    const newOptions = question.options.map((opt, i) => i === optionIdx ? value : opt);
    onChange({ ...question, options: newOptions });
  }

  // ── Helper: xóa 1 option ────────────────────────────────────
  // Ràng buộc: phải còn ít nhất 2 lựa chọn (không thể có câu hỏi 1 đáp án)
  function removeOption(optionIdx: number) {
    if (question.options.length <= 2) {
      notify.error('Câu hỏi phải có ít nhất 2 lựa chọn');
      return;
    }
    const newOptions = question.options.filter((_, i) => i !== optionIdx);

    // Sau khi xóa, các correctIndices phải được điều chỉnh:
    //   - Bỏ index vừa xóa khỏi danh sách correct (nếu có)
    //   - Giảm các index lớn hơn optionIdx xuống 1 (vì array bị thu nhỏ)
    const newCorrect = question.correctIndices
      .filter(i => i !== optionIdx)
      .map(i => i > optionIdx ? i - 1 : i);

    onChange({ ...question, options: newOptions, correctIndices: newCorrect });
  }

  // ── Helper: chọn/bỏ chọn đáp án đúng ────────────────────────
  // Logic khác nhau giữa single và multiple:
  //   - single:   chỉ giữ 1 index   → set = [optionIdx]
  //   - multiple: toggle index trong mảng → thêm/bỏ
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

  // ── Helper: đổi loại câu hỏi ────────────────────────────────
  // Khi đổi multiple → single: chỉ giữ 1 đáp án đúng đầu tiên
  // Khi đổi single → multiple: giữ nguyên correctIndices
  function changeType(newType: QuestionType) {
    let newCorrect = question.correctIndices;
    if (newType === 'single' && question.correctIndices.length > 1) {
      newCorrect = [question.correctIndices[0]];
    }
    onChange({ ...question, type: newType, correctIndices: newCorrect });
  }

  return (
    <div className="border border-outline-variant/40 rounded-xl bg-surface-container/30 overflow-hidden">

      {/* Header card: click để gập/mở, có nút xóa */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-container/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-bold text-on-surface text-sm">Câu {index + 1}</span>
          {/* Hiển thị preview câu hỏi khi gập */}
          {!isExpanded && question.text && (
            <span className="text-sm text-on-surface-variant line-clamp-1 flex-1">
              — {question.text}
            </span>
          )}
        </button>

        {/* Loại + điểm — hiển thị compact ở header */}
        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {question.type === 'single' ? '1 đáp án' : 'Nhiều đáp án'}
        </span>
        <span className="text-xs font-bold text-on-surface-variant">{question.points}đ</span>

        <button
          onClick={onDelete}
          title="Xóa câu hỏi"
          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Body card: chỉ render khi mở */}
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

              {/* Loại câu hỏi + Điểm (2 cột) */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Loại câu hỏi
                  </span>
                  <select
                    value={question.type}
                    onChange={e => changeType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="single">Trắc nghiệm 1 đáp án</option>
                    <option value="multiple">Trắc nghiệm nhiều đáp án</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Điểm
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={question.points}
                    onChange={e => onChange({ ...question, points: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  />
                </label>
              </div>

              {/* Các lựa chọn (options) */}
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

                        {/* Label A. B. C. */}
                        <span className="text-sm font-bold text-on-surface-variant w-5 flex-shrink-0">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>

                        {/* Input nội dung option */}
                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(optIdx, e.target.value)}
                          placeholder={`Lựa chọn ${String.fromCharCode(65 + optIdx)}`}
                          className="flex-1 px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                        />

                        {/* Xóa option (chỉ khi có > 2 options) */}
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

                {/* Nút thêm lựa chọn (giới hạn 6 cho gọn) */}
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

              {/* Lời giải thích (tùy chọn) */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Lời giải thích <span className="text-on-surface-variant/70 font-normal normal-case">(tùy chọn — hiển thị cho HS sau khi nộp bài)</span>
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

export default function TeacherQuizChapterPage() {
  // ── State chính ─────────────────────────────────────────────────
  // data: nguồn sự thật về các khóa/chương/quiz đã được commit
  const [data, setData] = useState<CourseInfo[]>(INITIAL_DATA);
  // Khóa đang chọn
  const [selectedCourseId, setSelectedCourseId] = useState<string>(INITIAL_DATA[0].id);
  // Chương đang chọn để chỉnh sửa quiz (null = chưa chọn)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // form: state CỤC BỘ chứa quiz đang chỉnh sửa.
  // Không phải data thật → user có thể "Hủy" mà không ảnh hưởng `data`.
  // Khi click "Lưu quiz" mới commit form về data.
  const [form, setForm] = useState<ChapterQuiz | null>(null);

  // Sidebar mobile toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Derived ─────────────────────────────────────────────────────
  const currentCourse = data.find(c => c.id === selectedCourseId);
  const currentChapter = currentCourse?.chapters.find(ch => ch.id === selectedChapterId);

  // Tổng điểm = sum points của các câu — hiển thị để GV biết quiz đáng bao nhiêu
  const totalPoints = form?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0;

  // ── Handler: chọn chương để bắt đầu edit quiz ───────────────────
  function selectChapter(chapter: ChapterInfo) {
    setSelectedChapterId(chapter.id);
    // Nếu chương đã có quiz → copy vào form để edit
    // Nếu chưa → khởi tạo quiz rỗng với 1 câu hỏi mẫu cho GV thấy ngay cấu trúc
    if (chapter.quiz) {
      setForm({ ...chapter.quiz, questions: chapter.quiz.questions.map(q => ({ ...q })) });
    } else {
      setForm({
        name: `Quiz ${chapter.title}`,
        durationMinutes: 15,
        passScorePercent: 70,
        questions: [],
      });
    }
  }

  // ── Handler: đổi khóa học ───────────────────────────────────────
  // Khi đổi khóa → đóng form và reset chương đang chọn để tránh hiển thị sai
  function changeCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedChapterId(null);
    setForm(null);
  }

  // ── Handler: thêm 1 câu hỏi mới vào form ────────────────────────
  // Khởi tạo câu hỏi rỗng kiểu 'single' với 2 lựa chọn để GV nhập luôn
  function addQuestion() {
    if (!form) return;
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      text: '',
      type: 'single',
      options: ['', ''],
      correctIndices: [],
      points: 1,
    };
    setForm({ ...form, questions: [...form.questions, newQuestion] });
  }

  // ── Handler: cập nhật 1 câu hỏi (gọi từ QuestionCard.onChange) ──
  function updateQuestion(idx: number, updated: Question) {
    if (!form) return;
    const newQuestions = form.questions.map((q, i) => i === idx ? updated : q);
    setForm({ ...form, questions: newQuestions });
  }

  // ── Handler: xóa 1 câu hỏi ──────────────────────────────────────
  function deleteQuestion(idx: number) {
    if (!form) return;
    setForm({ ...form, questions: form.questions.filter((_, i) => i !== idx) });
  }

  // ── Handler: lưu quiz ───────────────────────────────────────────
  // Validate cơ bản trước khi commit:
  //   - Tên quiz không rỗng
  //   - Thời gian > 0
  //   - Pass score trong khoảng 0-100
  //   - Có ít nhất 1 câu hỏi
  //   - Mỗi câu hỏi: text không rỗng, có ít nhất 1 đáp án đúng
  function saveQuiz() {
    if (!form || !selectedChapterId) return;

    if (!form.name.trim()) {
      notify.error('Vui lòng nhập tên quiz');
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
    if (form.questions.length === 0) {
      notify.error('Quiz phải có ít nhất 1 câu hỏi');
      return;
    }
    // Validate từng câu hỏi
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

    // Commit: tìm course → tìm chapter → gán quiz mới
    setData(prev => prev.map(course => {
      if (course.id !== selectedCourseId) return course;
      return {
        ...course,
        chapters: course.chapters.map(ch =>
          ch.id === selectedChapterId ? { ...ch, quiz: form } : ch
        ),
      };
    }));
    notify.success('Đã lưu quiz');
  }

  // ── Handler: hủy chỉnh sửa, đóng form ────────────────────────
  function cancelEdit() {
    setSelectedChapterId(null);
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

      {/* Overlay khi sidebar mở trên mobile */}
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

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Quiz chương</h1>
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
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Quiz cuối chương</h2>
            <p className="text-on-surface-variant text-sm mb-4">
              Mỗi chương có 1 quiz gắn ở cuối. Học sinh phải hoàn thành 100% chương mới mở được quiz.
            </p>

            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-2 block">Chọn khóa học</span>
              <select
                value={selectedCourseId}
                onChange={e => changeCourse(e.target.value)}
                className="w-full max-w-md px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
              >
                {data.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
          </motion.div>

          {/* Grid 2 cột: trái danh sách chương, phải form quiz */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — Danh sách chương */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Danh sách chương
              </h3>

              {!currentCourse || currentCourse.chapters.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Khóa học chưa có chương nào
                </p>
              ) : (
                <div className="space-y-2">
                  {currentCourse.chapters.map(chapter => {
                    // Trạng thái: chương đã có quiz hay chưa
                    const hasQuiz = !!chapter.quiz;
                    const isSelected = chapter.id === selectedChapterId;

                    return (
                      <button
                        key={chapter.id}
                        onClick={() => selectChapter(chapter)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        <p className={`font-bold text-sm mb-1 line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                          {chapter.title}
                        </p>
                        {/* Hiển thị status quiz: đã có hay chưa */}
                        {hasQuiz ? (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã có quiz · {chapter.quiz!.questions.length} câu · {chapter.quiz!.durationMinutes} phút
                          </p>
                        ) : (
                          <p className="text-xs text-on-surface-variant flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            Chưa có quiz — click để tạo
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — Form quiz */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
            >
              {!form || !currentChapter ? (
                // Khi chưa chọn chương nào
                <div className="text-center py-16">
                  <PenSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    Chọn 1 chương ở bên trái để bắt đầu tạo/sửa quiz
                  </p>
                </div>
              ) : (
                <>
                  {/* Tiêu đề + tên chương đang edit */}
                  <div className="mb-5 pb-4 border-b border-outline-variant/30">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">
                      Đang chỉnh sửa quiz cho
                    </p>
                    <h3 className="font-extrabold text-on-surface text-lg">
                      {currentChapter.title}
                    </h3>
                  </div>

                  {/* ── PHẦN 1: Cài đặt chung ──────────────────── */}
                  <div className="space-y-4 mb-6">
                    <p className="text-sm font-bold text-on-surface">Cài đặt chung</p>

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Tên quiz <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="VD: Quiz cuối chương 1"
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
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
                        {/* Tổng điểm là derived — không cho sửa, hiển thị để tham khảo */}
                        <div className="w-full px-3 py-2 text-sm bg-surface-container/50 border border-outline-variant/50 rounded-lg text-on-surface font-bold">
                          {totalPoints} điểm
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── PHẦN 2: Danh sách câu hỏi ─────────────── */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-on-surface">
                        Câu hỏi <span className="text-on-surface-variant font-normal">({form.questions.length})</span>
                      </p>
                    </div>

                    {form.questions.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-outline-variant/40 rounded-xl">
                        <p className="text-sm text-on-surface-variant">
                          Chưa có câu hỏi nào
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.questions.map((q, idx) => (
                          <QuestionCard
                            key={q.id}
                            question={q}
                            index={idx}
                            onChange={updated => updateQuestion(idx, updated)}
                            onDelete={() => deleteQuestion(idx)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Nút thêm câu hỏi */}
                    <button
                      onClick={addQuestion}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-primary border-2 border-dashed border-primary/30 hover:bg-primary/5 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm câu hỏi
                    </button>
                  </div>

                  {/* ── Nút hành động ──────────────────────────── */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/30">
                    <button
                      onClick={cancelEdit}
                      className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={saveQuiz}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                    >
                      <Save className="w-4 h-4" />
                      Lưu quiz
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
