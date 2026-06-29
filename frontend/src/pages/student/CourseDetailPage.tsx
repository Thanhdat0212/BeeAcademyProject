// ═══════════════════════════════════════════════════════════════════════════════
// TRANG CHI TIẾT KHÓA HỌC — CourseDetailPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /courses/:id
//   Người dùng đến từ: CoursesPage (click vào card khóa học)
//   Người dùng đi đến:
//     - Nếu chưa mua: thêm vào giỏ → CheckoutPage
//     - Nếu đã mua: xem bài học trong LearningView
//
// LUỒNG PHÂN NHÁNH CHÍNH (CourseDetailPage — default export):
//   1. Đọc :id từ URL params → tìm course trong MOCK_COURSES
//   2. Kiểm tra quyền truy cập: isEnrolled = course.isEnrolled || purchasedIds.includes(id)
//   3. Nếu isEnrolled=true  → render <LearningView>  (giao diện học bài)
//      Nếu isEnrolled=false → render <MarketingView> (trang giới thiệu + mua)
//
// CÁC COMPONENT CON:
//   - MarketingView: trang quảng cáo, thêm vào giỏ hàng
//   - LearningView:  giao diện học, sidebar mục lục, quiz
//   - QuizModal:     modal làm bài kiểm tra, 2 phase: quiz → results
//   - ScoreCircle:   vòng tròn SVG hiển thị điểm số
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, type SyntheticEvent } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Star, Users, PlayCircle, FileText, CheckCircle2,
  Lock, ShoppingCart, Video, Menu, X, MessageSquare, BookOpen,
  ClipboardList, XCircle, Award, RotateCcw, ChevronLeft, ChevronRight,
  Trophy, Loader2, Send, AlertCircle, Plus, Minus,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import type { Course, Lesson, QuizQuestion } from '../../data/mockCourses';
import { notify } from '../../lib/toast';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCourseStore } from '../../store/useCourseStore';
// API integration (Giai đoạn 1C) - thay MOCK_COURSES bằng call BE thật
import {
  getCourseDetail as courseServiceGetDetail,
  getCourseReviews,
  upsertCourseReview,
} from '../../api/courseService';
import { adaptCourseDetail, formatDurationSec } from '../../api/adapter';
import { isApiError } from '../../api/client';
import { listOrders, verifyPayment } from '../../api/orderService';
import {
  addCourseDiscussionReply,
  createCourseDiscussionThread,
  listCourseDiscussionThreads,
} from '../../api/courseDiscussionService';
import { listStudentCourseExams } from '../../api/examService';
import type { CourseDiscussionThread } from '../../api/courseDiscussionService';
import type { StudentExamSummaryResponse } from '../../api/examService';
import type { ChapterDetail, CourseReviewSummary, LessonDetail } from '../../types/api';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: ScoreCircle
//
// Hiển thị vòng tròn SVG animated thể hiện % điểm số.
// Màu vòng tròn thay đổi theo ngưỡng điểm:
//   ≥90% → xanh lá (xuất sắc)
//   ≥70% → xanh dương (giỏi)
//   ≥50% → vàng (khá)
//   <50%  → đỏ (cần cố gắng)
//
// KỸ THUẬT SVG:
//   Bán kính r=15.9 → chu vi = 2π×15.9 ≈ 100
//   → strokeDasharray="${dash} ${circumference}" với dash=(score/100)×circumference
//   → dash gần bằng đúng score (vd: score=75 → dash≈75/100)
//   → Trick này giúp điều chỉnh độ dài cung SVG trực quan theo %
// ═══════════════════════════════════════════════════════════════════════════════
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

type MarketingSyllabusSection = Omit<ChapterDetail, 'lessons'> & { lessons: Lesson[] };

function QuizModal({ lesson, prevScore, onClose, onComplete }: QuizModalProps) {
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
                      className={`rounded-2xl border-2 overflow-hidden ${
                        isCorrect
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                          : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {letter}
                      </div>
                      <span className={`font-medium text-sm leading-snug ${
                        isSelected ? 'text-on-surface' : 'text-on-surface-variant'
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
                className={`rounded-full transition-all duration-200 ${
                  i === currentIdx
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
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  allAnswered
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
function MarketingView({
  course,
  rawChapters,
  onStartPreview,
  onOpenLearning,
}: {
  course: Course;
  rawChapters: ChapterDetail[];
  onStartPreview?: (lessonId?: string) => void;
  onOpenLearning?: (lessonId?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'instructor' | 'reviews'>('overview');

  const addToCart = useCartStore(state => state.addToCart);
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const user = useAuthStore(state => state.user);
  const purchasedIds = useCourseStore(state => state.purchasedIds);
  const enrollCourses = useCourseStore(state => state.enrollCourses);
  const completedLessons = useCourseStore(state => state.completedLessons);
  const completedQuizzes = useCourseStore(state => state.completedQuizzes);
  const lessonDurations = useCourseStore(state => state.lessonDurations);
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<CourseReviewSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const syllabusSections = useMemo<MarketingSyllabusSection[]>(() => (
    rawChapters.length > 0
      ? [...rawChapters]
          .sort((a, b) => a.position - b.position)
          .map(chapter => ({
            ...chapter,
            lessons: [...chapter.lessons]
              .sort((a, b) => a.position - b.position)
              .map(adaptLearningLesson),
          }))
      : [{
          id: 'flat-lessons',
          title: 'Nội dung khóa học',
          description: null,
          position: 1,
          hasQuizConfig: false,
          lessons: course.lessons ?? [],
        }]
  ), [rawChapters, course.lessons]);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    () => new Set(syllabusSections.slice(0, 2).map(chapter => chapter.id))
  );
  const previewLessons = useMemo(
    () => course.lessons?.filter(lesson => lesson.type !== 'quiz' && Boolean(lesson.isFree)) ?? [],
    [course.lessons],
  );
  const completedList = completedLessons[course.id] ?? [];
  const completedQuizList = completedQuizzes[course.id] ?? [];
  const progressStats = useMemo(
    () => getCourseProgressStats(syllabusSections, completedList, completedQuizList),
    [syllabusSections, completedList, completedQuizList],
  );
  const progressPercent = progressStats.progressPercent;
  const isOwnedCourse = course.isEnrolled || purchasedIds.includes(course.id);
  const canSubmitReview = isOwnedCourse && user?.role === 'student';
  const primaryPreviewLesson = previewLessons.find(lesson => lesson.type === 'video') ?? previewLessons[0] ?? null;
  const previewCtaLabel = primaryPreviewLesson?.type === 'video'
    ? 'Xem video học thử'
    : 'Xem nội dung học thử';
  const displayRating = reviewSummary?.averageRating ?? course.rating;
  const displayReviewCount = reviewSummary?.reviewCount ?? course.reviewCount ?? 0;
  const visibleReviews = useMemo(() => {
    const myReviewId = reviewSummary?.myReview?.id;
    return (reviewSummary?.reviews ?? []).filter(review => review.id !== myReviewId);
  }, [reviewSummary]);

  const introVideoUrl = course.introVideoUrl?.trim();
  const introEmbedUrl = introVideoUrl ? toEmbeddableVideoUrl(introVideoUrl) : null;
  const introDirectUrl = introVideoUrl && isDirectVideoUrl(introVideoUrl) ? introVideoUrl : null;

  useEffect(() => {
    setExpandedChapterIds(new Set(syllabusSections.slice(0, 2).map(chapter => chapter.id)));
  }, [syllabusSections]);

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      setLoadingReviews(true);
      try {
        const data = await getCourseReviews(course.id);
        if (cancelled) return;
        setReviewSummary(data);
        setDraftRating(data.myReview?.rating ?? 0);
        setDraftComment(data.myReview?.comment ?? '');
      } catch (error) {
        if (!cancelled) {
          notify.error(isApiError(error) ? error.message : 'Không tải được đánh giá khóa học.');
        }
      } finally {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      }
    }

    loadReviews();
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  function toggleSyllabusChapter(chapterId: string) {
    setExpandedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  function handleAddToCart() {
    // Guard 1: chưa đăng nhập → redirect sang /login
    // Truyền state { from } để Login.tsx biết phải redirect về đâu sau khi login xong
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    // Guard 2: đã sở hữu rồi → không cho add thêm vào cart
    if (course.isEnrolled || purchasedIds.includes(course.id)) {
      notify.error('Bạn đã sở hữu khóa học này!');
      return;
    }
    // Hợp lệ → thêm vào giỏ + thông báo thành công
    addToCart({
      id: course.id,
      title: course.title,
      priceVnd: parseInt((course.price ?? '0').replace(/\D/g, '')) || 0,
      image: course.image,
    });
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
  }

  // Kích hoạt khóa học khi đã thanh toán nhưng enrollment chưa được ghi
  async function handleActivate() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    setActivating(true);
    try {
      const orders = await listOrders();
      const pending = orders.find(o =>
        o.status === 'PENDING' &&
        o.items.some(i => i.courseId === course.id)
      );
      if (!pending) {
        notify.error('Không tìm thấy đơn hàng cho khóa học này.');
        return;
      }
      const result = await verifyPayment(pending.id);
      if (result.status === 'PAID') {
        enrollCourses([course.id]);
        notify.success('Kích hoạt thành công! Đang tải...');
        window.location.reload();
      } else {
        notify.error('PayOS chưa xác nhận thanh toán. Vui lòng thử lại sau.');
      }
    } catch {
      notify.error('Không thể kích hoạt. Vui lòng liên hệ hỗ trợ.');
    } finally {
      setActivating(false);
    }
  }

  async function handleSubmitReview() {
    if (!canSubmitReview) {
      notify.error('Chỉ học sinh đã mua khóa học mới có thể đánh giá.');
      return;
    }
    if (draftRating < 1 || draftRating > 5) {
      notify.error('Vui lòng chọn số sao đánh giá từ 1 đến 5.');
      return;
    }

    setSavingReview(true);
    try {
      await upsertCourseReview(course.id, {
        rating: draftRating,
        comment: draftComment,
      });
      const refreshed = await getCourseReviews(course.id);
      setReviewSummary(refreshed);
      setDraftRating(refreshed.myReview?.rating ?? draftRating);
      setDraftComment(refreshed.myReview?.comment ?? draftComment);
      notify.success(refreshed.myReview ? 'Đã lưu đánh giá khóa học.' : 'Đã gửi đánh giá khóa học.');
    } catch (error) {
      notify.error(isApiError(error) ? error.message : 'Không thể lưu đánh giá lúc này.');
    } finally {
      setSavingReview(false);
    }
  }

  function renderReviewStars(value: number, clickable = false, onSelect?: (next: number) => void) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={!clickable}
            onClick={() => onSelect?.(star)}
            className={clickable ? 'transition-transform hover:scale-110' : 'cursor-default'}
          >
            <Star
              className={`h-5 w-5 ${star <= value ? 'fill-amber-500 text-amber-500' : 'text-outline-variant'}`}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      {/* HERO — nền gradient, tiêu đề lớn, thông số tóm tắt */}
      <div className="bg-surface-container-highest border-b border-outline-variant/30 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="max-w-[1200px] mx-auto w-full px-4 md:px-10 relative z-10">
          <Link to="/courses" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors font-semibold text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
          </Link>
          <div className="flex gap-3 mb-6">
            <span className="bg-surface text-on-surface text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">{course.grade}</span>
            <span className="bg-primary text-on-primary text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">{course.subject}</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-on-surface mb-6 leading-tight max-w-4xl">
            {course.title}
          </h1>
          <p className="text-xl text-on-surface-variant mb-8 max-w-3xl leading-relaxed">{course.description}</p>
            <div className="flex flex-wrap items-center gap-8 text-on-surface-variant font-medium">
              <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                <Star className="w-5 h-5 fill-amber-500" />
                <span className="text-lg font-bold">{displayRating > 0 ? displayRating.toFixed(1) : 'Mới'}</span>
                <span className="text-sm text-amber-700/80">
                  ({displayReviewCount.toLocaleString('vi-VN')} đánh giá)
                </span>
              </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{course.students.toLocaleString('vi-VN')} học viên</span>
            </div>
            <div className="flex items-center gap-2">
              Giảng viên: <strong className="text-on-surface">{course.instructor}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN: -mt-10 để content đè lên hero banner tạo hiệu ứng nổi */}
      <main className="flex-grow max-w-[1200px] mx-auto w-full px-4 md:px-10 -mt-10 pb-20 relative z-20">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Cột nội dung (trái): tabs thông tin */}
          <div className="lg:col-span-2">
            {/* Tab navigation */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/50 p-2 mb-8 flex overflow-x-auto">
              {([
                { id: 'overview', label: 'Tổng quan' },
                { id: 'syllabus', label: 'Nội dung học' },
                { id: 'instructor', label: 'Giảng viên' },
                { id: 'reviews', label: 'Đánh giá' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-6 rounded-2xl font-bold text-sm md:text-base whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content — AnimatePresence mode="wait" để chuyển tab mượt mà */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/50 p-6 md:p-10 min-h-[400px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                      <BookOpen className="text-primary w-6 h-6" /> Bạn sẽ học được gì?
                    </h2>
                    <div className="text-on-surface-variant leading-relaxed space-y-4 text-lg">
                      <p>{course.detailedDescription}</p>
                      {(course.objective || course.audience) && (
                        <div className="grid md:grid-cols-2 gap-5">
                          {course.objective && (
                            <section className="border-l-4 border-primary/50 pl-4 py-1">
                              <h3 className="text-sm font-extrabold text-on-surface mb-1">Mục tiêu khóa học</h3>
                              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-line">{course.objective}</p>
                            </section>
                          )}
                          {course.audience && (
                            <section className="border-l-4 border-primary/50 pl-4 py-1">
                              <h3 className="text-sm font-extrabold text-on-surface mb-1">Đối tượng học viên</h3>
                              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-line">{course.audience}</p>
                            </section>
                          )}
                        </div>
                      )}
                      <p>Khóa học bao gồm đầy đủ hệ thống bài giảng video chất lượng cao, bài tập tự luyện và tài liệu PDF đính kèm.</p>
                      <ul className="grid sm:grid-cols-2 gap-4 mt-8">
                        {['Nắm vững kiến thức trọng tâm', 'Luyện tập với bài tập thực tế', 'Hỗ trợ giải đáp 24/7', 'Truy cập trọn đời'].map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                            <span className="text-on-surface">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'syllabus' && (
                  <motion.div key="syllabus" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div className="flex justify-between items-end mb-6">
                      <h2 className="text-2xl font-bold text-on-surface">Mục lục khóa học</h2>
                      <span className="text-on-surface-variant text-sm font-medium">{course.lessons?.length ?? 0} bài</span>
                    </div>
                    <MarketingSyllabusList
                      course={course}
                      sections={syllabusSections}
                      expandedChapterIds={expandedChapterIds}
                      completedList={completedList}
                      lessonDurations={lessonDurations}
                      isOwnedCourse={isOwnedCourse}
                      onToggleChapter={toggleSyllabusChapter}
                      onStartPreview={onStartPreview}
                      onOpenLearning={onOpenLearning}
                    />
                  </motion.div>
                )}
                {activeTab === 'instructor' && (
                  <motion.div key="instructor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <h2 className="text-2xl font-bold text-on-surface mb-6">Thông tin Giảng viên</h2>
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <img
                        src={`https://ui-avatars.com/api/?name=${course.instructor.replace(/ /g, '+')}&background=random&size=128`}
                        alt={course.instructor}
                        className="w-24 h-24 rounded-full shadow-md"
                      />
                      <div>
                        <h3 className="text-xl font-bold text-on-surface mb-2">{course.instructor}</h3>
                        <p className="text-primary font-semibold mb-4">Giảng viên xuất sắc tại Bee Academy</p>
                        <p className="text-on-surface-variant leading-relaxed">
                          Với hơn 10 năm kinh nghiệm giảng dạy, luôn truyền cảm hứng và đem đến phương pháp học tập hiệu quả, dễ hiểu nhất. Hàng ngàn học sinh đã đạt điểm giỏi nhờ khóa học này.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'reviews' && (
                  <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container p-6 text-center">
                          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-on-surface-variant">Điểm đánh giá</p>
                          <p className="mt-3 text-5xl font-extrabold text-on-surface">
                            {displayRating > 0 ? displayRating.toFixed(1) : '0.0'}
                          </p>
                          <div className="mt-3 flex justify-center">
                            {renderReviewStars(Math.round(displayRating))}
                          </div>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            {displayReviewCount.toLocaleString('vi-VN')} học viên đã đánh giá
                          </p>
                        </div>

                        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-2xl font-bold text-on-surface">Cảm nhận từ học viên</h2>
                              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                                Đánh giá công khai giúp học viên khác hiểu rõ hơn về chất lượng nội dung, cách giảng dạy và mức độ phù hợp của khóa học.
                              </p>
                            </div>
                            <div className="rounded-2xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                              UC19
                            </div>
                          </div>
                        </div>
                      </div>

                      {canSubmitReview && (
                        <section className="rounded-3xl border border-primary/15 bg-primary/5 p-6">
                          <div className="flex flex-col gap-4">
                            <div>
                              <h3 className="text-lg font-extrabold text-on-surface">
                                {reviewSummary?.myReview ? 'Cập nhật đánh giá của bạn' : 'Viết đánh giá khóa học'}
                              </h3>
                              <p className="mt-1 text-sm text-on-surface-variant">
                                Chia sẻ cảm nhận thực tế sau khi học để giúp Bee Academy cải thiện nội dung tốt hơn.
                              </p>
                            </div>

                            <div>
                              <p className="mb-2 text-sm font-bold text-on-surface">Số sao đánh giá</p>
                              {renderReviewStars(draftRating, true, setDraftRating)}
                            </div>

                            <label className="block">
                              <span className="mb-2 block text-sm font-bold text-on-surface">Nhận xét</span>
                              <textarea
                                value={draftComment}
                                onChange={event => setDraftComment(event.target.value)}
                                rows={4}
                                maxLength={2000}
                                placeholder="Điều bạn thích nhất ở khóa học là gì? Nội dung, cách giảng dạy hoặc phần nào cần cải thiện?"
                                className="w-full rounded-2xl border border-outline-variant/40 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary"
                              />
                              <span className="mt-1 block text-right text-xs text-on-surface-variant">
                                {draftComment.length}/2000
                              </span>
                            </label>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={handleSubmitReview}
                                disabled={savingReview}
                                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
                              >
                                {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {reviewSummary?.myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                              </button>
                            </div>
                          </div>
                        </section>
                      )}

                      {!canSubmitReview && isOwnedCourse && (
                        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container p-5">
                          <p className="text-sm text-on-surface-variant">
                            Tài khoản hiện tại không phải học sinh, nên không thể gửi đánh giá cho khóa học này.
                          </p>
                        </section>
                      )}

                      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6">
                        <div className="mb-5 flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-extrabold text-on-surface">Đánh giá gần đây</h3>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Hiển thị những nhận xét mới nhất từ học viên đã tham gia khóa học.
                            </p>
                          </div>
                        </div>

                        {loadingReviews ? (
                          <div className="flex justify-center py-12 text-on-surface-variant">
                            <Loader2 className="h-7 w-7 animate-spin" />
                          </div>
                        ) : visibleReviews.length === 0 && !reviewSummary?.myReview ? (
                          <div className="rounded-3xl border border-dashed border-outline-variant/40 bg-surface-container p-8 text-center">
                            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/40" />
                            <p className="font-bold text-on-surface">Chưa có đánh giá nào</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Hãy trở thành người đầu tiên chia sẻ trải nghiệm của bạn về khóa học này.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {reviewSummary?.myReview && (
                              <article className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={reviewSummary.myReview.studentAvatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewSummary.myReview.studentName ?? 'Bạn')}&background=feb700&color=1f2937&bold=true`}
                                      alt={reviewSummary.myReview.studentName ?? 'Bạn'}
                                      className="h-12 w-12 rounded-full object-cover"
                                    />
                                    <div>
                                      <p className="font-extrabold text-on-surface">
                                        {reviewSummary.myReview.studentName ?? 'Bạn'}
                                      </p>
                                      <p className="text-xs font-semibold text-primary">Đánh giá của bạn</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {renderReviewStars(reviewSummary.myReview.rating)}
                                    <p className="mt-1 text-xs text-on-surface-variant">
                                      {new Date(reviewSummary.myReview.updatedAt).toLocaleDateString('vi-VN')}
                                    </p>
                                  </div>
                                </div>
                                {reviewSummary.myReview.comment && (
                                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                                    {reviewSummary.myReview.comment}
                                  </p>
                                )}
                              </article>
                            )}

                            {visibleReviews.map(review => (
                              <article key={review.id} className="rounded-3xl border border-outline-variant/25 bg-surface p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={review.studentAvatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(review.studentName ?? 'Học viên')}&background=e5e7eb&color=111827&bold=true`}
                                      alt={review.studentName ?? 'Học viên'}
                                      className="h-11 w-11 rounded-full object-cover"
                                    />
                                    <div>
                                      <p className="font-bold text-on-surface">{review.studentName ?? 'Học viên Bee Academy'}</p>
                                      <p className="text-xs text-on-surface-variant">
                                        {new Date(review.updatedAt).toLocaleDateString('vi-VN')}
                                      </p>
                                    </div>
                                  </div>
                                  {renderReviewStars(review.rating)}
                                </div>
                                {review.comment && (
                                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                                    {review.comment}
                                  </p>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cột mua hàng (phải): sticky card — luôn hiển thị khi scroll */}
          <div className="lg:col-span-1 relative">
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[2rem] p-6 shadow-2xl shadow-primary/10 sticky top-28">
              <div className="rounded-2xl overflow-hidden mb-6 aspect-video relative group">
                {introEmbedUrl ? (
                  <iframe
                    src={introEmbedUrl}
                    title={`Video giới thiệu ${course.title}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : introDirectUrl ? (
                  <video
                    src={introDirectUrl}
                    poster={course.image && !isDirectVideoUrl(course.image) ? course.image : undefined}
                    controls
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <>
                    <SafeCourseImage
                      course={course}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {primaryPreviewLesson && onStartPreview ? (
                        <button
                          type="button"
                          onClick={() => onStartPreview(primaryPreviewLesson.id)}
                          className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg cursor-pointer hover:scale-110 transition-transform"
                        >
                          <PlayCircle className="w-8 h-8 ml-1" />
                        </button>
                      ) : (
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg">
                          <PlayCircle className="w-8 h-8 ml-1" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {isOwnedCourse ? (
                <>
                  <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-on-surface">Bạn đã sở hữu khóa học này</p>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                          {progressPercent > 0
                            ? `Bạn đã hoàn thành ${progressStats.completedItems}/${progressStats.totalItems} nội dung học.`
                            : 'Khóa học đã sẵn sàng để bạn bắt đầu học ngay.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenLearning()}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg shadow-primary/30 transition-all hover:-translate-y-1 hover:shadow-primary/50"
                  >
                    <PlayCircle className="h-6 w-6" />
                    {progressPercent > 0 ? 'Tiếp tục học' : 'Vào học ngay'}
                  </button>
                  <div className="mb-6 rounded-2xl bg-surface-container p-4">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                      <span className="text-primary">Tiến độ học tập</span>
                      <span className="text-on-surface">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Giá: hiển thị giá gốc + giá gạch ngang (giả lập 1.5x) */}
                  <div className="text-3xl font-extrabold text-primary mb-1 text-center">{course.price}</div>
                  <div className="text-center text-sm text-on-surface-variant line-through mb-6">
                    {(parseInt(course.price?.replace(/\D/g, '') ?? '0') * 1.5).toLocaleString('vi-VN')}đ
                  </div>
                  {/* CTA: handleAddToCart() — chỉ thêm vào giỏ khi đã đăng nhập */}
                  <button
                    onClick={handleAddToCart}
                    className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mb-3"
                  >
                    <ShoppingCart className="w-6 h-6" />
                    Thêm vào giỏ hàng
                  </button>
                </>
              )}
              {!isOwnedCourse && primaryPreviewLesson && onStartPreview && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-on-surface">Nội dung học thử</p>
                      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                        Xem trước {previewLessons.length} bài miễn phí trước khi quyết định mua khóa học.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartPreview(primaryPreviewLesson.id)}
                    className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-amber-500/90"
                  >
                    {previewCtaLabel}
                  </button>
                </div>
              )}
              {!isOwnedCourse && isLoggedIn && (
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="w-full py-2.5 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {activating ? 'Đang kích hoạt...' : 'Đã thanh toán? Kích hoạt khóa học'}
                </button>
              )}
              <div className="text-center text-xs font-semibold text-on-surface-variant mb-6 uppercase tracking-wider">
                Thanh toán an toàn · Truy cập trọn đời
              </div>
              <hr className="border-outline-variant/40 my-6" />
              {/* Tóm tắt những gì có trong khóa học — đếm từ course.lessons theo type */}
              <h4 className="font-bold mb-4 text-on-surface">Khóa học bao gồm:</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <Video className="w-5 h-5 text-primary" />
                  {course.lessons?.filter(l => l.type === 'video').length ?? 0} video bài giảng
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <FileText className="w-5 h-5 text-primary" />
                  {course.lessons?.filter(l => l.type === 'pdf').length ?? 0} tài liệu PDF
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  {course.lessons?.filter(l => l.type === 'quiz').length ?? 0} bài kiểm tra theo chương
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Q&A hỗ trợ trực tiếp
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Chứng nhận hoàn thành
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: LearningView
//
// Hiển thị khi user ĐÃ MUA khóa học.
// Giao diện học giống YouTube/Udemy: video player trái + sidebar mục lục phải.
//
// STATE QUAN TRỌNG:
//   activeLesson  — bài học đang xem (video/pdf), quyết định nội dung player
//   activeQuiz    — bài quiz đang mở (null = không có modal), tách biệt với activeLesson
//   quizScores    — Record<lessonId, điểm%> lưu điểm các quiz trong session
//   isSidebarOpen — toggle sidebar mục lục (ẩn/hiện)
//
// TẠI SAO activeQuiz TÁCH BIỆT activeLesson?
//   Quiz không hiển thị trong video player — chúng mở modal overlay.
//   Nếu dùng chung, khi user đóng quiz thì video player cũng bị reset.
//   Tách biệt: click quiz → setActiveQuiz(lesson), click video/pdf → setActiveLesson(lesson)
//
// SIDEBAR:
//   Mỗi item là một bài trong course.lessons
//   Quiz items: hiển thị badge "Quiz" + điểm nếu đã làm (từ quizScores)
//   Video/PDF items: hiển thị icon type + dấu tích xanh nếu isCompleted
//   Sidebar slide in/out từ bên phải với spring animation
// ═══════════════════════════════════════════════════════════════════════════════
function formatDiscussionDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarFor(name: string, avatarUrl?: string | null, size = 40): string {
  return avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${size}`;
}

function roleLabel(role: string): string {
  if (role === 'teacher') return 'Giáo viên';
  if (role === 'admin') return 'Admin';
  if (role === 'parent') return 'Phụ huynh';
  return 'Học viên';
}

function toEmbeddableVideoUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('youtube.com')) {
      if (parsed.pathname.includes('/embed/')) return url;
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

function SafeCourseImage({
  course,
  className,
  fallbackClassName = '',
  alt = '',
}: {
  course: Course;
  className: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = course.image?.trim();
  const canUseImage = Boolean(imageUrl) && !isDirectVideoUrl(imageUrl) && !failed;

  if (canUseImage) {
    return (
      <img
        src={imageUrl}
        alt={alt || course.title}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div className={`${className} ${fallbackClassName} bg-surface-container-high flex flex-col items-center justify-center text-center px-5`}>
      <BookOpen className="w-10 h-10 text-primary mb-3" />
      <p className="text-sm font-extrabold text-on-surface line-clamp-2">{course.title}</p>
      <p className="text-xs font-semibold text-on-surface-variant mt-1">{course.subject} · {course.grade}</p>
    </div>
  );
}

function adaptLearningLesson(lesson: LessonDetail): Lesson {
  const hasVideo = Boolean(lesson.videoUrl || lesson.videoEmbedUrl);
  const hasDocuments = (lesson.documents?.length ?? 0) > 0;
  const type: Lesson['type'] = hasVideo || !hasDocuments ? 'video' : 'pdf';
  return {
    id: lesson.id,
    title: lesson.title,
    duration: formatDurationSec(lesson.durationSec),
    type,
    url: hasVideo
      ? (lesson.videoUrl ?? lesson.videoEmbedUrl ?? '#')
      : (lesson.documents?.[0]?.fileUrl ?? '#'),
    isFree: lesson.isFree,
    isCompleted: false,
    documents: lesson.documents ?? [],
  };
}

function canOpenLesson(course: Course, lesson: Lesson): boolean {
  return course.isEnrolled || Boolean(lesson.isFree);
}

function getLessonDisplayDuration(
  courseId: string,
  lesson: Lesson,
  lessonDurations: Record<string, Record<string, number>>,
): string {
  const durationSec = lessonDurations[courseId]?.[lesson.id];
  return durationSec && durationSec > 0 ? formatDurationSec(durationSec) : lesson.duration;
}

function preloadLessonDuration(
  lesson: Lesson,
  onResolved: (durationSec: number) => void,
): () => void {
  const video = document.createElement('video');
  const cleanup = () => {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
  };

  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      onResolved(video.duration);
    }
    cleanup();
  };
  video.onerror = cleanup;
  video.src = lesson.url;

  return cleanup;
}

function getCourseProgressStats(
  chapters: Array<{ id: string; hasQuizConfig: boolean; lessons: Lesson[] }>,
  completedLessonIds: string[],
  completedQuizIds: string[],
) {
  const videoIds = new Set<string>();
  const quizIds = new Set<string>();
  const completedLessonSet = new Set(completedLessonIds);
  const completedQuizSet = new Set(completedQuizIds);

  chapters.forEach((chapter) => {
    let hasInlineQuizLesson = false;

    chapter.lessons.forEach((lesson) => {
      if (lesson.type === 'video') {
        videoIds.add(lesson.id);
      }
      if (lesson.type === 'quiz') {
        quizIds.add(lesson.id);
        hasInlineQuizLesson = true;
      }
    });

    if (chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && !hasInlineQuizLesson) {
      quizIds.add(chapter.id);
    }
  });

  const completedVideoCount = [...videoIds].filter((id) => completedLessonSet.has(id)).length;
  const completedQuizCount = [...quizIds].filter((id) => completedQuizSet.has(id)).length;
  const totalItems = videoIds.size + quizIds.size;
  const completedItems = completedVideoCount + completedQuizCount;

  return {
    totalItems,
    completedItems,
    progressPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
  };
}

function MarketingSyllabusList({
  course,
  sections,
  expandedChapterIds,
  completedList,
  lessonDurations,
  isOwnedCourse,
  onToggleChapter,
  onStartPreview,
  onOpenLearning,
}: {
  course: Course;
  sections: MarketingSyllabusSection[];
  expandedChapterIds: Set<string>;
  completedList: string[];
  lessonDurations: Record<string, Record<string, number>>;
  isOwnedCourse: boolean;
  onToggleChapter: (chapterId: string) => void;
  onStartPreview?: (lessonId?: string) => void;
  onOpenLearning?: (lessonId?: string) => void;
}) {
  return (
    <div className="space-y-7">
      {sections.map((chapter, chapterIndex) => {
        const isExpanded = expandedChapterIds.has(chapter.id);
        const videoLessons = chapter.lessons.filter(lesson => lesson.type === 'video');
        const completedVideoCount = videoLessons.filter(lesson =>
          completedList.includes(lesson.id)
        ).length;

        return (
          <section key={chapter.id} className="space-y-3">
            <button
              type="button"
              onClick={() => onToggleChapter(chapter.id)}
              aria-expanded={isExpanded}
              className="w-full flex items-start justify-between gap-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-primary">
                  Chương {chapterIndex + 1}
                </p>
                <h3 className="text-base font-extrabold leading-snug text-on-surface">
                  {chapter.title}
                </h3>
              </div>
              <span className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
                {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pl-1 sm:pl-3">
                    {chapter.lessons.map((lesson, lessonIndex) => {
                      const isLessonCompleted = completedList.includes(lesson.id);
                      const canPreviewLesson = Boolean(lesson.isFree && onStartPreview);
                      const canOpen = isOwnedCourse || canPreviewLesson;

                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          onClick={() => {
                            if (isOwnedCourse) {
                              onOpenLearning?.(lesson.id);
                            } else if (canPreviewLesson) {
                              onStartPreview?.(lesson.id);
                            }
                          }}
                          disabled={!canOpen}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all disabled:cursor-default ${
                            isLessonCompleted
                              ? 'border-green-500/25 bg-green-500/5 text-green-700'
                              : canPreviewLesson
                              ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                              : 'border-transparent bg-surface hover:bg-surface-container disabled:hover:bg-surface'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                              isLessonCompleted
                                ? 'bg-green-500/15 text-green-600'
                                : canPreviewLesson
                                ? 'bg-primary/10 text-primary'
                                : 'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              {isLessonCompleted
                                ? <CheckCircle2 className="h-4 w-4" />
                                : lesson.type === 'video'
                                ? <PlayCircle className="h-4 w-4" />
                                : lesson.type === 'pdf'
                                ? <FileText className="h-4 w-4" />
                                : <ClipboardList className="h-4 w-4" />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-extrabold leading-snug text-current">
                                Bài {lessonIndex + 1}: {lesson.title.replace(/^Bài\s*\d+\s*[:.-]?\s*/i, '')}
                              </h4>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                                <span className={canPreviewLesson ? 'text-primary' : 'text-on-surface-variant'}>
                                  {getLessonDisplayDuration(course.id, lesson, lessonDurations)}
                                </span>
                                {canPreviewLesson && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
                                    Học thử miễn phí
                                  </span>
                                )}
                                {isLessonCompleted && (
                                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-extrabold text-green-700">
                                    Đã hoàn thành
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && (
                      <div className="w-full rounded-2xl border border-transparent bg-surface-container/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                            <Lock className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-on-surface-variant">Quiz chương {chapterIndex + 1}</p>
                            <p className="text-xs font-medium text-on-surface-variant">
                              Hoàn thành {completedVideoCount}/{videoLessons.length} video để mở quiz
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

function LearningView({ course, rawChapters, courseId, initialLessonId, onExitPreview }: {
  course: Course;
  rawChapters: ChapterDetail[];
  courseId: string;
  initialLessonId?: string | null;
  onExitPreview?: () => void;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isPreviewMode = !course.isEnrolled;
  const addToCart = useCartStore(state => state.addToCart);
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const navigate = useNavigate();

  // BUG FIX: guard khi course không có lesson nào (tránh crash do undefined)
  const requestedLesson = initialLessonId
    ? course.lessons?.find(l => l.id === initialLessonId && l.type !== 'quiz' && canOpenLesson(course, l))
    : null;
  const firstLesson = requestedLesson
    ?? course.lessons?.find(l => l.type !== 'quiz' && canOpenLesson(course, l))
    ?? course.lessons?.find(l => canOpenLesson(course, l))
    ?? null;

  // Khởi tạo activeLesson = bài đầu tiên không phải quiz
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(firstLesson);
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'notes'>('overview');

  // BUG FIX: state báo hiệu signed video URL đã hết hạn (sau 1 giờ)
  // — browser tự phát lỗi khi URL 403, <video onError> sẽ bắt và set flag này
  const [videoUrlExpired, setVideoUrlExpired] = useState(false);

  // activeQuiz: null = không hiện modal, Lesson = hiện QuizModal cho bài đó
  const [activeQuiz, setActiveQuiz] = useState<Lesson | null>(null);

  // Lấy dữ liệu và actions từ Zustand store
  const completedLessons = useCourseStore((state) => state.completedLessons);
  const markLessonCompleted = useCourseStore((state) => state.markLessonCompleted);
  const completedQuizzes = useCourseStore((state) => state.completedQuizzes);
  const markQuizCompleted = useCourseStore((state) => state.markQuizCompleted);
  const lessonDurations = useCourseStore((state) => state.lessonDurations);
  const saveLessonDuration = useCourseStore((state) => state.saveLessonDuration);
  const quizScores = useCourseStore((state) => state.quizScores);
  const saveQuizScore = useCourseStore((state) => state.saveQuizScore);
  const lessonNotes = useCourseStore((state) => state.lessonNotes);
  const saveLessonNote = useCourseStore((state) => state.saveLessonNote);

  // State cục bộ cho ghi chú
  const [noteText, setNoteText] = useState('');

  // State cục bộ cho Q&A
  const [qaInput, setQaInput] = useState('');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [discussionThreads, setDiscussionThreads] = useState<CourseDiscussionThread[]>([]);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [postingReplyId, setPostingReplyId] = useState<string | null>(null);
  const [studentExams, setStudentExams] = useState<StudentExamSummaryResponse[]>([]);

  const chapterSections = useMemo(() => (
    rawChapters.length > 0
      ? [...rawChapters]
          .sort((a, b) => a.position - b.position)
          .map(chapter => ({
            ...chapter,
            lessons: [...chapter.lessons]
              .sort((a, b) => a.position - b.position)
              .map(adaptLearningLesson),
          }))
      : [{
          id: 'flat-lessons',
          title: 'Nội dung khóa học',
          description: null,
          position: 1,
          hasQuizConfig: false,
          lessons: course.lessons ?? [],
        }]
  ), [rawChapters, course.lessons]);

  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    () => new Set(chapterSections.slice(0, 1).map(chapter => chapter.id))
  );

  useEffect(() => {
    setActiveLesson(firstLesson);
    setActiveQuiz(null);
    setActiveTab('overview');
    setVideoUrlExpired(false);
    setExpandedChapterIds(new Set(chapterSections.slice(0, 1).map(chapter => chapter.id)));
  }, [chapterSections, course.id, firstLesson]);

  // Cập nhật nội dung ghi chú khi chuyển bài học
  useEffect(() => {
    if (activeLesson) {
      const savedNote = lessonNotes[course.id]?.[activeLesson.id] ?? '';
      setNoteText(savedNote);

    }
  }, [activeLesson, course.id, lessonNotes]);

  useEffect(() => {
    if (!activeLesson) return;

    const activeChapter = chapterSections.find(chapter =>
      chapter.lessons.some(lesson => lesson.id === activeLesson.id)
    );
    if (!activeChapter) return;

    setExpandedChapterIds(prev => {
      if (prev.has(activeChapter.id)) return prev;
      const next = new Set(prev);
      next.add(activeChapter.id);
      return next;
    });
  }, [activeLesson, chapterSections]);

  useEffect(() => {
    if (activeTab !== 'qa') return;

    let cancelled = false;
    setLoadingDiscussion(true);
    listCourseDiscussionThreads(course.id)
      .then(items => {
        if (!cancelled) setDiscussionThreads(items);
      })
      .catch(error => {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : 'Không tải được thảo luận');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscussion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, course.id]);

  useEffect(() => {
    let cancelled = false;
    listStudentCourseExams(course.id)
      .then(items => {
        if (!cancelled) setStudentExams(items);
      })
      .catch(() => {
        if (!cancelled) setStudentExams([]);
      });

    return () => {
      cancelled = true;
    };
  }, [course.id]);

  // Tính toán tiến độ học tập thực tế dựa trên completedLessons
  const completedList = completedLessons[course.id] ?? [];
  const completedQuizList = completedQuizzes[course.id] ?? [];
  const progressStats = useMemo(
    () => getCourseProgressStats(chapterSections, completedList, completedQuizList),
    [chapterSections, completedList, completedQuizList],
  );
  const progressPercent = progressStats.progressPercent;

  // Router điều hướng click trong sidebar
  function handleLessonClick(lesson: Lesson) {
    if (!canOpenLesson(course, lesson)) {
      notify.error('Bài học này cần mua khóa học để mở khóa.');
      return;
    }
    if (lesson.type === 'quiz') {
      setActiveQuiz(lesson);
    } else {
      setActiveLesson(lesson);
      setVideoUrlExpired(false); // reset lỗi URL cũ khi chuyển sang bài mới
    }
  }

  function handleUnlockCourse() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    addToCart({
      id: course.id,
      title: course.title,
      priceVnd: parseInt((course.price ?? '0').replace(/\D/g, '')) || 0,
      image: course.image,
    });
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
  }

  // Callback từ QuizModal khi user nộp bài
  function handleVideoEnded() {
    if (!activeLesson || completedList.includes(activeLesson.id)) {
      return;
    }
    markLessonCompleted(course.id, activeLesson.id);
    notify.success('Đã hoàn thành video bài học!');
  }

  function handleVideoMetadataLoaded(event: SyntheticEvent<HTMLVideoElement>) {
    if (!activeLesson) {
      return;
    }
    saveLessonDuration(course.id, activeLesson.id, event.currentTarget.duration);
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  function handleQuizComplete(lessonId: string, score: number) {
    saveQuizScore(course.id, lessonId, score);
    markQuizCompleted(course.id, lessonId);
  }

  const handleSaveNote = () => {
    saveLessonNote(course.id, activeLesson.id, noteText);
    notify.success('Đã lưu ghi chú thành công!');
  };

  function upsertDiscussionThread(thread: CourseDiscussionThread) {
    setDiscussionThreads(prev => {
      const exists = prev.some(item => item.id === thread.id);
      const next = exists
        ? prev.map(item => item.id === thread.id ? thread : item)
        : [thread, ...prev];
      return next.sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );
    });
  }

  const handleAddQuestion = async () => {
    const content = qaInput.trim();
    if (!content) return;
    try {
      setPostingQuestion(true);
      const thread = await createCourseDiscussionThread(course.id, {
        lessonId: activeLesson?.id ?? null,
        content,
      });
      upsertDiscussionThread(thread);
      setQaInput('');
      notify.success('Đã đăng câu hỏi thảo luận thành công!');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không đăng được câu hỏi');
    } finally {
      setPostingQuestion(false);
    }
  };

  const handleAddReply = async (questionId: string) => {
    const text = replyInputs[questionId] ?? '';
    if (!text.trim()) return;
    try {
      setPostingReplyId(questionId);
      const thread = await addCourseDiscussionReply(course.id, questionId, text.trim());
      upsertDiscussionThread(thread);
      setReplyInputs((prev) => ({ ...prev, [questionId]: '' }));
      notify.success('Đã gửi phản hồi thành công!');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được phản hồi');
    } finally {
      setPostingReplyId(null);
    }
  };

  const questionsList = discussionThreads;

  return (
    <div className="h-screen bg-surface flex flex-col font-sans overflow-hidden">

      {/* ── Topbar cố định ── */}
      <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Nút back về danh sách khóa học */}
          <Link to="/courses" className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant hover:text-on-surface">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-outline-variant/50 hidden sm:block" />
          <h1 className="font-bold text-on-surface truncate max-w-[200px] sm:max-w-md text-sm">
            {course.title}
          </h1>
          {isPreviewMode && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-extrabold text-amber-600">
              Học thử
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Thanh tiến độ tổng — Tính toán động từ store */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
            <div className="w-32 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          {isPreviewMode && onExitPreview && (
            <button
              onClick={onExitPreview}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
            >
              <ChevronLeft className="h-4 w-4" />
              Thông tin khóa học
            </button>
          )}
          {isPreviewMode && (
            <button
              onClick={handleUnlockCourse}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              <ShoppingCart className="h-4 w-4" />
              Mua khóa
            </button>
          )}
          {/* Toggle sidebar mục lục */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-2"
          >
            <Menu className="w-5 h-5" />
            <span className="hidden sm:inline font-semibold text-sm">Mục lục</span>
          </button>
        </div>
      </header>

      {/* ── Main area: player + sidebar ── */}
      <div className="flex-grow flex relative overflow-hidden bg-surface-container-lowest">

        {/* Cột nội dung: player + tabs thông tin bài học */}
        <div className={`flex flex-col flex-grow transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'lg:pr-[380px]' : ''}`}>

          {/* Video / PDF player (giả lập) */}
          <div className="w-full bg-black aspect-video relative group flex-shrink-0 overflow-hidden">
            {/* Hiển thị thông báo khi signed URL hết hạn (sau 1 giờ) */}
            {videoUrlExpired ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <AlertCircle className="w-14 h-14 text-orange-400 relative z-10" />
                <p className="text-base font-semibold relative z-10">Link video đã hết hạn</p>
                <p className="text-sm text-white/60 relative z-10 max-w-xs">
                  Signed URL chỉ có hiệu lực 1 giờ. Tải lại trang để lấy link mới.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="relative z-10 mt-1 px-5 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-colors text-on-primary"
                >
                  Tải lại trang
                </button>
              </div>
            ) : activeLesson?.type === 'video' && activeLesson?.url && activeLesson.url !== '#' ? (
              // Kiểm tra embed URL (YouTube/Vimeo) hay direct video
              activeLesson.url.includes('youtube.com') ||
              activeLesson.url.includes('youtu.be') ||
              activeLesson.url.includes('vimeo.com') ||
              activeLesson.url.includes('/embed/') ? (
                // iframe cho YouTube/Vimeo
                <iframe
                  key={activeLesson.id}
                  src={activeLesson.url}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeLesson.title}
                />
              ) : (
                // <video> cho file upload (signed URL từ Supabase Storage, TTL 1 giờ)
                <video
                  key={activeLesson.id}
                  src={activeLesson.url}
                  className="absolute inset-0 w-full h-full"
                  controls
                  controlsList="nodownload"
                  playsInline
                  onLoadedMetadata={handleVideoMetadataLoaded}
                  onEnded={handleVideoEnded}
                  onError={() => setVideoUrlExpired(true)}
                />
              )
            ) : activeLesson?.type === 'video' ? (
              // Video chưa có URL — có thể chưa upload hoặc backend chưa trả signed URL
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <AlertCircle className="w-14 h-14 text-yellow-400 relative z-10" />
                <p className="text-base font-semibold relative z-10">
                  {activeLesson.isFree ? 'Bài học thử chưa có video' : 'Video chưa sẵn sàng'}
                </p>
                <p className="text-sm text-white/60 relative z-10 max-w-xs">
                  {activeLesson.isFree
                    ? 'Giáo viên cần upload video hoặc gắn link YouTube/Vimeo cho bài học thử này.'
                    : 'Nội dung đang được tải lên hoặc xử lý. Vui lòng tải lại trang sau ít phút.'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="relative z-10 mt-2 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
                >
                  Tải lại trang
                </button>
              </div>
            ) : activeLesson?.type === 'pdf' ? (
              // PDF viewer
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <FileText className="w-16 h-16 mb-4 opacity-80 text-blue-400 relative z-10" />
                <h3 className="text-2xl font-bold relative z-10">Tài liệu PDF</h3>
                {activeLesson?.url && activeLesson.url !== '#' ? (
                  <a
                    href={activeLesson.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors relative z-10"
                  >
                    Mở tài liệu
                  </a>
                ) : (
                  <p className="mt-4 text-sm text-white/60 relative z-10">Tài liệu đang được chuẩn bị</p>
                )}
              </div>
            ) : (
              // Thumbnail mặc định
              <SafeCourseImage course={course} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            )}
          </div>

          {/* Thông tin bài học + tabs (Overview / Q&A / Notes) */}
          <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-on-surface mb-2">{activeLesson?.title}</h2>
                <div className="text-on-surface-variant font-medium flex items-center gap-2">
                  <span>Bài học</span> ·
                  <span className="text-primary">{activeLesson?.type === 'video' ? 'Video giảng' : 'Tài liệu lý thuyết'}</span>
                </div>
              </div>
            </div>

            {/* Tab navigation với animated underline indicator (layoutId) */}
            <div className="border-b border-outline-variant/30 flex gap-8 mb-8">
              {([
                { id: 'overview', label: 'Tổng quan' },
                { id: 'qa', label: 'Hỏi đáp (Q&A)' },
                { id: 'notes', label: 'Ghi chú của tôi' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 font-bold text-sm md:text-base transition-colors relative ${
                    activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="learningTabIndicator" className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-[200px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <p className="text-on-surface-variant leading-relaxed text-lg">
                      Nội dung chi tiết của {activeLesson?.title}. Chú ý theo dõi kỹ các ví dụ thực hành trong bài. Sau khi học xong, hãy làm bài kiểm tra cuối chương để củng cố kiến thức.
                    </p>
                    {activeLesson?.documents && activeLesson.documents.length > 0 && (
                      <div>
                        <h4 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Tài liệu đính kèm
                        </h4>
                        <div className="space-y-2">
                          {activeLesson.documents.map((doc, idx) => {
                            const ext = doc.fileType?.toUpperCase() ?? 'FILE';
                            const sizeKb = doc.fileSizeBytes ? Math.round(doc.fileSizeBytes / 1024) : null;
                            return (
                              <a
                                key={idx}
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/40 bg-surface-container hover:border-primary hover:bg-surface-container-high transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <p className="font-semibold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    {ext}{sizeKb != null ? ` · ${sizeKb} KB` : ''}
                                  </p>
                                </div>
                                <ArrowLeft className="w-4 h-4 text-on-surface-variant group-hover:text-primary rotate-180 flex-shrink-0 transition-colors" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {activeTab === 'qa' && (
                  <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    {/* Form câu hỏi mới */}
                    <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/30 space-y-3">
                      <h4 className="font-bold text-sm text-on-surface">Đặt câu hỏi thảo luận</h4>
                      {activeLesson && (
                        <p className="text-xs text-on-surface-variant font-medium">
                          Bài hiện tại: <span className="text-on-surface">{activeLesson.title}</span>
                        </p>
                      )}
                      <div className="flex gap-3">
                        <textarea
                          value={qaInput}
                          onChange={(e) => setQaInput(e.target.value)}
                          placeholder="Viết câu hỏi thắc mắc của bạn tại đây để mọi người cùng trao đổi..."
                          className="flex-grow min-h-[90px] p-4 text-sm rounded-2xl bg-surface border border-outline-variant/40 focus:border-primary outline-none resize-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddQuestion}
                          disabled={postingQuestion}
                          className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {postingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Gửi câu hỏi
                        </button>
                      </div>
                    </div>

                    {/* Danh sách các câu hỏi Q&A */}
                    <div className="space-y-4">
                      {loadingDiscussion ? (
                        <div className="flex items-center justify-center py-10 text-on-surface-variant">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : questionsList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-60">
                          <MessageSquare className="w-12 h-12 mb-4 text-on-surface-variant" />
                          <p className="font-semibold text-on-surface text-sm">Chưa có câu hỏi nào.</p>
                        </div>
                      ) : (
                        questionsList.map((qa) => (
                          <div key={qa.id} className="bg-surface border border-outline-variant/20 p-5 rounded-2xl space-y-4 shadow-sm">
                            <div className="flex gap-3 items-start">
                              <img
                                src={avatarFor(qa.authorName, qa.authorAvatarUrl, 40)}
                                alt={qa.authorName}
                                className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-on-surface">{qa.authorName}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {roleLabel(qa.authorRole)}
                                  </span>
                                  {qa.lessonTitle && (
                                    <span className="text-[10px] text-on-surface-variant/70 line-clamp-1">
                                      {qa.lessonTitle}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-on-surface-variant/60">{formatDiscussionDate(qa.createdAt)}</span>
                                </div>
                                <p className="text-on-surface text-sm mt-2 leading-relaxed font-semibold">
                                  {qa.content}
                                </p>
                              </div>
                            </div>

                            {/* Replies List */}
                            {qa.replies && qa.replies.length > 0 && (
                              <div className="pl-6 border-l-2 border-outline-variant/40 space-y-3 mt-3">
                                {qa.replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-2.5 items-start">
                                    <img
                                      src={avatarFor(reply.authorName, reply.authorAvatarUrl, 32)}
                                      alt={reply.authorName}
                                      className="w-8 h-8 rounded-full flex-shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 bg-surface-container/20 p-3 rounded-xl">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-xs text-on-surface">{reply.authorName}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                          {roleLabel(reply.authorRole)}
                                        </span>
                                        <span className="text-[9px] text-on-surface-variant/50">{formatDiscussionDate(reply.createdAt)}</span>
                                      </div>
                                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed font-medium">
                                        {reply.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply Input Form */}
                            <div className="flex gap-2 items-center pl-6 pt-2">
                              <input
                                type="text"
                                placeholder="Viết phản hồi thảo luận..."
                                value={replyInputs[qa.id] ?? ''}
                                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [qa.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddReply(qa.id);
                                  }
                                }}
                                className="flex-grow px-3 py-2 text-xs rounded-xl bg-surface-container/50 border border-outline-variant/30 focus:border-primary focus:bg-surface outline-none text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
                              />
                              <button
                                onClick={() => handleAddReply(qa.id)}
                                disabled={postingReplyId === qa.id}
                                className="px-3.5 py-2 bg-secondary-container hover:bg-secondary-container/95 text-on-secondary-container rounded-xl font-bold text-xs transition-colors whitespace-nowrap disabled:opacity-60"
                              >
                                {postingReplyId === qa.id ? 'Đang gửi...' : 'Phản hồi'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
                {activeTab === 'notes' && (
                  <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onBlur={() => saveLessonNote(course.id, activeLesson.id, noteText)}
                      placeholder="Ghi chú các kiến thức quan trọng của bài học này... (hệ thống sẽ tự động lưu khi bạn thoát nhấp chuột)"
                      className="w-full min-h-[160px] p-4 rounded-2xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-on-surface placeholder:text-on-surface-variant/50 transition-all font-medium"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveNote}
                        className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md hover:bg-primary/90 transition-all"
                      >
                        Lưu ghi chú
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Sidebar mục lục (slide từ phải) ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="w-full lg:w-[380px] bg-surface border-l border-outline-variant/30 flex flex-col h-full absolute right-0 top-0 bottom-0 z-20 shadow-2xl lg:shadow-none"
            >
              <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface sticky top-0 z-10">
                <h3 className="text-base font-bold text-on-surface">Mục lục khóa học</h3>
                {/* Nút đóng sidebar — chỉ hiện trên mobile */}
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-surface-container rounded-lg lg:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto px-3 py-4 space-y-4">
                {chapterSections.map((chapter, chapterIndex) => {
                  const isExpanded = expandedChapterIds.has(chapter.id);
                  const examSlotIndex = Math.floor(chapterIndex / 3);
                  const exam = studentExams.find(item => item.slotIndex === examSlotIndex);
                  const shouldShowExam = (chapterIndex + 1) % 3 === 0 && exam;
                  const videoLessonsInChapter = chapter.lessons.filter(lesson => lesson.type === 'video');
                  const completedVideoCount = videoLessonsInChapter.filter(lesson =>
                    completedList.includes(lesson.id)
                  ).length;
                  const isChapterVideoCompleted = videoLessonsInChapter.length === 0 ||
                    completedVideoCount === videoLessonsInChapter.length;
                  const isChapterQuizCompleted = completedQuizList.includes(chapter.id);

                  return (
                    <div key={chapter.id} className="space-y-2">
                    <section className="border-b border-outline-variant/30 last:border-b-0 pb-2">
                      <button
                        type="button"
                        onClick={() => toggleChapter(chapter.id)}
                        aria-expanded={isExpanded}
                        className="w-full rounded-xl px-2.5 py-2 flex items-start justify-between gap-3 text-left hover:bg-surface-container transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                            Chương {chapterIndex + 1}
                          </p>
                          <h4 className="text-sm font-extrabold text-on-surface leading-snug line-clamp-2">
                            {chapter.title}
                          </h4>
                        </div>
                        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high">
                          {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1 pl-3 pt-1">
                              {chapter.lessons.map((lesson, lessonIndex) => {
                                const isActive = activeLesson?.id === lesson.id;
                                const isCompleted = lesson.type === 'quiz'
                                  ? completedQuizList.includes(lesson.id)
                                  : completedList.includes(lesson.id);
                                const isLocked = !canOpenLesson(course, lesson);

                                return (
                                  <button
                                    key={lesson.id}
                                    onClick={() => handleLessonClick(lesson)}
                                    className={`w-full text-left rounded-xl border px-3 py-2.5 flex gap-3 transition-all ${
                                      isLocked
                                        ? 'bg-surface-container/40 border-transparent opacity-75 hover:opacity-100'
                                        : isActive
                                        ? 'bg-primary/10 border-primary/30 shadow-sm'
                                        : 'bg-surface hover:bg-surface-container border-transparent'
                                    }`}
                                  >
                                    <div className="mt-0.5 flex-shrink-0">
                                      {isLocked
                                        ? <Lock className="w-4.5 h-4.5 text-on-surface-variant" />
                                        : isCompleted
                                        ? <CheckCircle2 className="w-4.5 h-4.5 text-green-500" />
                                        : lesson.type === 'video'
                                        ? <PlayCircle className={`w-4.5 h-4.5 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
                                        : <FileText className={`w-4.5 h-4.5 ${isActive ? 'text-blue-500' : 'text-on-surface-variant'}`} />
                                      }
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-sm font-semibold leading-snug line-clamp-2 ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                                        Bài {lessonIndex + 1}: {lesson.title.replace(/^Bài\s*\d+\s*[:.-]?\s*/i, '')}
                                      </p>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-on-surface-variant">
                                          {getLessonDisplayDuration(course.id, lesson, lessonDurations)}
                                        </span>
                                        {lesson.isFree && isPreviewMode && (
                                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
                                            Học thử
                                          </span>
                                        )}
                                        {isLocked && (
                                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-extrabold text-on-surface-variant">
                                            Cần mua khóa
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}

                              {chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && (
                                course.isEnrolled && isChapterVideoCompleted ? (
                                  <Link
                                    to={`/courses/${courseId}/chapters/${chapter.id}/quiz`}
                                    className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 flex items-center gap-3 bg-surface hover:bg-amber-500/5 hover:border-amber-500/20 transition-all group"
                                  >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      isChapterQuizCompleted
                                        ? 'bg-green-500/10 text-green-600'
                                        : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20'
                                    }`}>
                                      {isChapterQuizCompleted
                                        ? <CheckCircle2 className="w-4 h-4" />
                                        : <ClipboardList className="w-4 h-4" />
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-on-surface line-clamp-1">Quiz chương {chapterIndex + 1}</p>
                                      <p className={`text-xs font-medium ${isChapterQuizCompleted ? 'text-green-600' : 'text-amber-600'}`}>
                                        {isChapterQuizCompleted ? 'Đã hoàn thành quiz' : 'Làm quiz ngay'}
                                      </p>
                                    </div>
                                  </Link>
                                ) : (
                                  <div className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 flex items-center gap-3 bg-surface-container/40 opacity-75">
                                    <div className="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center flex-shrink-0">
                                      <Lock className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-on-surface line-clamp-1">Quiz chương {chapterIndex + 1}</p>
                                      <p className="text-xs text-on-surface-variant font-medium">
                                        {course.isEnrolled
                                          ? `Hoàn thành ${completedVideoCount}/${videoLessonsInChapter.length} video để mở quiz`
                                          : 'Cần mua khóa để làm quiz'}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>

                    {shouldShowExam && (
                      exam.unlocked ? (
                        <Link
                          to={`/courses/${courseId}/exams/${exam.slotIndex}`}
                          className={`w-full text-left rounded-2xl border px-3 py-3 flex items-start gap-3 transition-all ${
                            exam.passed
                              ? 'bg-green-500/5 border-green-500/25 hover:bg-green-500/10'
                              : 'bg-primary/5 border-primary/25 hover:bg-primary/10'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            exam.passed ? 'bg-green-500/15 text-green-600' : 'bg-primary/15 text-primary'
                          }`}>
                            {exam.passed ? <CheckCircle2 className="w-4.5 h-4.5" /> : <ClipboardList className="w-4.5 h-4.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-extrabold line-clamp-2 ${exam.passed ? 'text-green-700' : 'text-primary'}`}>
                              {exam.name}
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-on-surface-variant">
                              {exam.passed
                                ? `Đã đạt ${exam.latestScorePercent ?? 0}%`
                                : `Mở khóa sau ${exam.passedQuizCount}/${exam.requiredQuizCount} quiz · Làm bài ngay`}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <div className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container/50 px-3 py-3 flex items-start gap-3 opacity-90">
                          <div className="w-8 h-8 rounded-xl bg-surface-container-high text-on-surface-variant flex items-center justify-center flex-shrink-0">
                            <Lock className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-on-surface line-clamp-2">{exam.name}</p>
                            <p className="mt-0.5 text-xs font-medium text-on-surface-variant">
                              {exam.lockedReason ?? `Cần pass ${exam.requiredQuizCount} quiz chương`}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-on-surface-variant">
                              Đã pass {exam.passedQuizCount}/{exam.requiredQuizCount} quiz
                            </p>
                          </div>
                        </div>
                      )
                    )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QuizModal */}
      <AnimatePresence>
        {activeQuiz && (
          <QuizModal
            lesson={activeQuiz}
            prevScore={quizScores[course.id]?.[activeQuiz.id]}
            onClose={() => setActiveQuiz(null)}
            onComplete={handleQuizComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT: CourseDetailPage
//
// Entry point duy nhất — đọc :id từ URL, fetch chi tiết từ BE (UC07),
// phân nhánh render Marketing/Learning view.
//
// GIAI ĐOẠN 1C:
//   - MarketingView render chi tiết từ API thật (mô tả + curriculum 2 cấp
//     được flatten bởi adapter.flattenChaptersToLessons).
//   - LearningView vẫn dùng dữ liệu Course đã adapt, nhưng logic enrollment
//     tạm thời check qua purchasedIds (Zustand local) - sẽ refactor ở
//     Module 3 khi có API enrollment thật.
// ═══════════════════════════════════════════════════════════════════════════════
export default function CourseDetailPage() {
  // Đọc :id từ URL /courses/:id — id là UUID của BE
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchasedIds = useCourseStore((state) => state.purchasedIds);
  const lessonDurations = useCourseStore((state) => state.lessonDurations);
  const saveLessonDuration = useCourseStore((state) => state.saveLessonDuration);

  // ── State fetch từ API ──────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [rawChapters, setRawChapters] = useState<ChapterDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  // ── Fetch course detail mỗi khi id thay đổi ─────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    courseServiceGetDetail(id)
      .then(async (detail) => {
        setCourse(adaptCourseDetail(detail));
        setRawChapters(detail.chapters);
      })
      .catch((err) => {
        // 404 từ BE → hiển thị empty state. Lỗi khác → toast.
        if (isApiError(err) && err.status === 404) {
          setNotFound(true);
        } else {
          const message = isApiError(err) ? err.message : 'Không thể tải khóa học';
          notify.error(message);
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id, purchasedIds]);

  // ── Loading state ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!course?.lessons?.length) {
      return;
    }

    const storedDurations = lessonDurations[course.id] ?? {};
    const candidates = course.lessons.filter((lesson) =>
      lesson.type === 'video' &&
      lesson.duration === '00:00' &&
      lesson.url !== '#' &&
      isDirectVideoUrl(lesson.url) &&
      !storedDurations[lesson.id]
    );

    if (candidates.length === 0) {
      return;
    }

    const cleanups = candidates.map((lesson) =>
      preloadLessonDuration(lesson, (durationSec) => {
        saveLessonDuration(course.id, lesson.id, durationSec);
      })
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [course, lessonDurations, saveLessonDuration]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-on-surface-variant">Đang tải khóa học...</p>
      </div>
    );
  }

  // ── Not found state ─────────────────────────────────────────────────────
  if (notFound || !course) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-on-surface mb-4">Không tìm thấy khóa học</h1>
        <Link to="/courses" className="text-primary hover:underline font-bold">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  // Kiểm tra quyền truy cập từ backend (enrolled = đã mua / GV sở hữu / Admin)
  const isEnrolled = course.isEnrolled || purchasedIds.includes(course.id);
  const courseWithAccess = { ...course, isEnrolled };
  const hasFreePreviewLesson = courseWithAccess.lessons?.some(lesson =>
    lesson.type !== 'quiz' && Boolean(lesson.isFree)
  ) ?? false;
  const isPreviewRequested = searchParams.get('preview') === '1';
  const isLearningRequested = searchParams.get('learn') === '1';
  const requestedLessonId = searchParams.get('lesson');

  function openPreview(lessonId?: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('learn');
      next.set('preview', '1');
      if (lessonId) {
        next.set('lesson', lessonId);
      } else {
        next.delete('lesson');
      }
      return next;
    });
  }

  function closePreview() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('preview');
      next.delete('lesson');
      return next;
    });
  }

  function openLearning(lessonId?: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('preview');
      next.set('learn', '1');
      if (lessonId) {
        next.set('lesson', lessonId);
      } else {
        next.delete('lesson');
      }
      return next;
    });
  }

  function closeLearning() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('learn');
      next.delete('lesson');
      return next;
    });
  }

  // BUG FIX: guard khi đã enrolled nhưng course chưa có lesson nào
  // — tránh crash trong LearningView khi activeLesson = undefined bị dereference
  if ((isEnrolled || hasFreePreviewLesson) && (!courseWithAccess.lessons || courseWithAccess.lessons.length === 0)) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <BookOpen className="w-14 h-14 text-on-surface-variant/30" />
        <h2 className="text-xl font-bold text-on-surface">Khóa học chưa có bài giảng</h2>
        <p className="text-on-surface-variant text-sm">Giáo viên đang chuẩn bị nội dung. Vui lòng quay lại sau.</p>
        <Link to="/courses" className="text-primary hover:underline font-semibold text-sm">
          Quay lại danh sách khóa học
        </Link>
      </div>
    );
  }

  return (isEnrolled && isLearningRequested) || (hasFreePreviewLesson && isPreviewRequested) ? (
    <LearningView
      course={courseWithAccess}
      rawChapters={rawChapters}
      courseId={id!}
      initialLessonId={requestedLessonId}
      onExitPreview={isEnrolled ? closeLearning : closePreview}
    />
  ) : (
    <MarketingView
      course={courseWithAccess}
      rawChapters={rawChapters}
      onStartPreview={!isEnrolled && hasFreePreviewLesson ? openPreview : undefined}
      onOpenLearning={isEnrolled ? openLearning : undefined}
    />
  );
}
