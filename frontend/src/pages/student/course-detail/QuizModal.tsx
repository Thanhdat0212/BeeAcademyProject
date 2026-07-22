import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Lesson, QuizQuestion } from '../../../types/course';

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 15.9;
  const dash = (score / 100) * circumference;
  const color =
    score >= 90 ? '#22c55e' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-36 h-36">
      {/* -rotate-90: xoay SVG để cung bắt đầu từ 12 giờ thay vì 3 giờ */}
      <svg viewBox="0 0 36 36" className="w-36 h-36 -rotate-90">
        {/* Vòng tròn nền (màu xám nhạt) */}
        <circle
          cx="18" cy="18" r="15.9"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className="text-surface-container-high"
        />
        {/* Vòng tròn điểm (animate từ 0 → dash) */}
        <motion.circle
          cx="18" cy="18" r="15.9"
          fill="none" strokeWidth="2.5" strokeLinecap="round"
          stroke={color}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      {/* Text điểm số ở giữa vòng tròn */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
        <motion.span
          className="text-3xl font-extrabold"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}%
        </motion.span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: QuizModal
//
// Modal làm bài kiểm tra theo chương, có 2 phase:
//   'quiz'    → Màn hình làm bài: hiển thị từng câu hỏi, chọn đáp án, điều hướng
//   'results' → Màn hình kết quả: vòng tròn điểm, review từng câu đúng/sai
//
// PROPS:
//   lesson     — bài học quiz (chứa mảng questions[])
//   prevScore  — điểm lần làm trước (nếu có), hiển thị để so sánh
//   onClose    — đóng modal (set activeQuiz = null trong LearningView)
//   onComplete — callback sau khi nộp bài: (lessonId, score) → lưu điểm vào quizScores
//
// STATE LUỒNG:
//   answers[]  — mảng lưu đáp án user chọn cho từng câu (null = chưa chọn)
//   currentIdx — câu đang hiển thị (0-based)
//   phase      — 'quiz' | 'results'
//
// LUỒNG NGƯỜI DÙNG:
//   Chọn đáp án → handleSelect() cập nhật answers[currentIdx]
//   Điều hướng qua lại → setCurrentIdx (Trước/Tiếp theo)
//   Nhấn dots → nhảy thẳng đến câu bất kỳ
//   Nộp bài (khi đã trả lời hết) → handleSubmit() tính điểm → phase='results'
//   Làm lại → handleRetry() reset toàn bộ về phase='quiz'
// ═══════════════════════════════════════════════════════════════════════════════
interface QuizModalProps {
  lesson: Lesson;
  prevScore?: number;
  onClose: () => void;
  onComplete: (lessonId: string, score: number) => void;
}

export default function QuizModal({ lesson, prevScore, onClose, onComplete }: QuizModalProps) {
  const questions: QuizQuestion[] = lesson.questions ?? [];
  const [currentIdx, setCurrentIdx] = useState(0);

  // answers[i] = index đáp án user chọn cho câu i, null = chưa chọn
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [phase, setPhase] = useState<'quiz' | 'results'>('quiz');
  const [score, setScore] = useState(0);

  // Trường hợp không có câu hỏi — hiển thị thông báo
  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-surface rounded-3xl p-10 text-center max-w-sm w-full">
          <p className="font-semibold text-on-surface-variant mb-4">Bài kiểm tra chưa có câu hỏi.</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold">Đóng</button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const allAnswered = answers.every((a: number | null) => a !== null);
  const answeredCount = answers.filter((a: number | null) => a !== null).length;

  // Ghi lại đáp án user chọn cho câu hiện tại
  function handleSelect(optIdx: number) {
    setAnswers((prev: (number | null)[]) => {
      const next = [...prev];
      next[currentIdx] = optIdx;
      return next;
    });
  }

  // Tính điểm khi nộp bài:
  //   Đếm số câu đúng (answers[i] === questions[i].correctIndex)
  //   Điểm = (số đúng / tổng câu) × 100, làm tròn
  //   Gọi onComplete để lưu điểm vào quizScores trong LearningView
  function handleSubmit() {
    const correct = answers.reduce<number>(
      (acc: number, a: number | null, i: number) => acc + (a === questions[i].correctIndex ? 1 : 0),
      0
    );
    const pct = Math.round((correct / questions.length) * 100);
    setScore(pct);
    setPhase('results');
    onComplete(lesson.id, pct);
  }

  // Reset toàn bộ state về trạng thái ban đầu để làm lại
  function handleRetry() {
    setAnswers(Array(questions.length).fill(null));
    setCurrentIdx(0);
    setPhase('quiz');
    setScore(0);
  }

  // Label và màu kết quả theo ngưỡng điểm
  const gradeLabel =
    score >= 90 ? '🏆 Xuất sắc!' :
      score >= 70 ? '🌟 Giỏi!' :
        score >= 50 ? '👍 Khá!' :
          '💪 Cần cố gắng thêm!';

  const gradeColor =
    score >= 90 ? 'text-green-500' :
      score >= 70 ? 'text-blue-500' :
        score >= 50 ? 'text-amber-500' :
          'text-red-500';

  const correctCount = answers.filter((a: number | null, i: number) => a === questions[i].correctIndex).length;

  // ── Phase: Kết quả ─────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-surface rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Trophy className="w-5 h-5" />
              <span className="font-semibold text-sm">{lesson.title}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-container rounded-xl transition-colors text-on-surface-variant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Vòng tròn điểm + label kết quả */}
            <div className="flex flex-col items-center py-8 px-6">
              <ScoreCircle score={score} />
              <motion.p
                className={`text-2xl font-extrabold mt-4 ${gradeColor}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                {gradeLabel}
              </motion.p>
              <motion.p
                className="text-on-surface-variant mt-2 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Đúng <span className="font-bold text-on-surface">{correctCount}/{questions.length}</span> câu
                {/* Hiển thị điểm lần trước nếu user đã từng làm bài này */}
                {prevScore !== undefined && (
                  <span className="ml-2 text-primary">
                    (lần trước: {prevScore}%)
                  </span>
                )}
              </motion.p>
            </div>

            {/* Review từng câu: xanh = đúng, đỏ = sai + giải thích đáp án */}
            <div className="px-6 pb-6">
              <h3 className="font-bold text-base text-on-surface mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Chi tiết từng câu
              </h3>
              <div className="space-y-3">
                {questions.map((question, i) => {
                  const isCorrect = answers[i] === question.correctIndex;
                  return (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className={`rounded-2xl border-2 overflow-hidden ${isCorrect
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                        }`}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                          {isCorrect
                            ? <CheckCircle2 className="w-4.5 h-4.5" />
                            : <XCircle className="w-4.5 h-4.5" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-on-surface mb-2 leading-snug">
                            Câu {i + 1}: {question.text}
                          </p>
                          {/* Chỉ hiển thị "Bạn chọn: ..." khi sai */}
                          {!isCorrect && answers[i] !== null && (
                            <p className="text-xs text-red-600 mb-1">
                              Bạn chọn: <span className="font-semibold">{question.options[answers[i]!]}</span>
                            </p>
                          )}
                          <p className={`text-xs font-semibold mb-2 ${isCorrect ? 'text-green-600' : 'text-green-700'}`}>
                            {isCorrect ? '✓ Đúng rồi!' : `Đáp án đúng: ${question.options[question.correctIndex]}`}
                          </p>
                          {/* Giải thích — luôn hiển thị để user học thêm */}
                          <p className="text-xs text-on-surface-variant italic leading-relaxed">
                            {question.explanation}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer: 2 nút — Làm Lại (reset state) hoặc Đóng (về LearningView) */}
          <div className="p-5 border-t border-outline-variant/20 flex gap-3 flex-shrink-0 bg-surface">
            <button
              onClick={handleRetry}
              className="flex-1 py-3 border-2 border-outline-variant hover:border-primary hover:text-primary rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-on-surface-variant"
            >
              <RotateCcw className="w-4 h-4" />
              Làm Lại
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Phase: Làm bài ─────────────────────────────────────────────────────────
  // Click ngoài modal → đóng; click bên trong → e.stopPropagation() để không bị đóng
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-surface rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header: tên bài + số câu hiện tại */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-extrabold text-lg text-on-surface leading-tight">{lesson.title}</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Câu{' '}
              <span className="font-bold text-primary">{currentIdx + 1}</span>
              {' '}/ {questions.length}
              {answeredCount < questions.length && (
                <span className="ml-2 text-amber-500 font-semibold">
                  · Còn {questions.length - answeredCount} câu chưa trả lời
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container rounded-xl transition-colors text-on-surface-variant flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tiến độ: rộng = (câu hiện tại / tổng câu) × 100% */}
        <div className="h-1.5 bg-surface-container mx-0 flex-shrink-0">
          <motion.div
            className="h-full bg-primary rounded-r-full"
            animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Câu hỏi — AnimatePresence mode="wait": câu cũ exit xong mới render câu mới */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              {/* Nội dung câu hỏi */}
              <div className="bg-surface-container/60 rounded-2xl p-5 mb-6 border border-outline-variant/30">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                  Câu {currentIdx + 1}
                </p>
                <p className="text-base font-semibold text-on-surface leading-relaxed">{q.text}</p>
              </div>

              {/* Các lựa chọn A/B/C/D — highlight màu primary khi được chọn */}
              <div className="space-y-3">
                {q.options.map((opt, i) => {
                  const isSelected = currentAnswer === i;
                  const letter = ['A', 'B', 'C', 'D'][i];
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSelect(i)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                        ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                        : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container'
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0 transition-colors ${isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                        {letter}
                      </div>
                      <span className={`font-medium text-sm leading-snug ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'
                        }`}>
                        {opt}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Điều hướng: dots + nút Trước/Tiếp theo/Nộp Bài */}
        <div className="px-6 py-5 border-t border-outline-variant/20 flex-shrink-0 bg-surface">
          {/* Dots điều hướng nhanh:
              - Câu hiện tại: pill ngang (w-6)
              - Đã trả lời: tròn màu primary/50
              - Chưa trả lời: tròn màu xám */}
          <div className="flex justify-center gap-2 mb-4">
            {questions.map((_: QuizQuestion, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                title={`Câu ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${i === currentIdx
                  ? 'w-6 h-3 bg-primary'
                  : answers[i] !== null
                    ? 'w-3 h-3 bg-primary/50 hover:bg-primary/70'
                    : 'w-3 h-3 bg-surface-container-high hover:bg-outline-variant'
                  }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Nút Trước — disabled ở câu đầu tiên */}
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant font-semibold text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Trước
            </button>

            <div className="flex-1" />

            {/* Nút Tiếp theo (câu chưa phải cuối) hoặc Nộp Bài (câu cuối)
                Nộp Bài chỉ active khi allAnswered=true (đã trả lời hết) */}
            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Tiếp theo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${allAnswered
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/30'
                  : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60'
                  }`}
              >
                <Trophy className="w-4 h-4" />
                Nộp Bài
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MarketingView
//
// Hiển thị khi user CHƯA mua khóa học.
// Mục tiêu: thuyết phục user mua — hero banner, tabs thông tin, sticky purchase card.
//
// LUỒNG THÊM VÀO GIỎ HÀNG:
//   1. User nhấn "Thêm vào giỏ hàng" → handleAddToCart()
//   2. Kiểm tra đăng nhập: chưa → redirect /login với state { from: /courses/:id }
//      Sau khi login xong, Login.tsx sẽ navigate về đúng trang này
//   3. Kiểm tra đã sở hữu: đã mua rồi → toast lỗi, dừng lại
//   4. Hợp lệ → addToCart(course) → toast thành công
//   5. User vào /checkout để thanh toán
//
// 3 TABS:
//   'overview'   — Bạn sẽ học được gì (checklist + mô tả chi tiết)
//   'syllabus'   — Nội dung khóa học (danh sách bài học với icon type)
//   'instructor' — Thông tin giảng viên (avatar + bio)
// ═══════════════════════════════════════════════════════════════════════════════
