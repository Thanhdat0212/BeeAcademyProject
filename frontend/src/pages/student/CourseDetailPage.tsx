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

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Star, Users, PlayCircle, FileText, CheckCircle2,
  Lock, ShoppingCart, Video, Menu, X, MessageSquare, BookOpen,
  ClipboardList, XCircle, Award, RotateCcw, ChevronLeft, ChevronRight,
  Trophy, Loader2,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import type { Course, Lesson, QuizQuestion } from '../../data/mockCourses';
import { notify } from '../../lib/toast';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCourseStore } from '../../store/useCourseStore';
// API integration (Giai đoạn 1C) - thay MOCK_COURSES bằng call BE thật
import { getCourseDetail as courseServiceGetDetail } from '../../api/courseService';
import { adaptCourseDetail } from '../../api/adapter';
import { isApiError } from '../../api/client';

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
function MarketingView({ course }: { course: Course }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'instructor'>('overview');

  // Store: addToCart thêm course vào giỏ hàng (Zustand useCartStore)
  const addToCart = useCartStore(state => state.addToCart);

  // Store: kiểm tra đăng nhập trước khi cho phép mua
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);

  // Store: kiểm tra đã mua rồi chưa (tránh mua trùng)
  const purchasedIds = useCourseStore(state => state.purchasedIds);
  const navigate = useNavigate();

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
    addToCart(course);
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
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
              <span className="text-lg font-bold">{course.rating}</span>
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
                      <h2 className="text-2xl font-bold text-on-surface">Nội dung khóa học</h2>
                      <span className="text-on-surface-variant text-sm font-medium">{course.lessons?.length ?? 0} bài</span>
                    </div>
                    {/* Danh sách bài học với icon theo type: video/pdf/quiz */}
                    <div className="space-y-3">
                      {course.lessons?.map(lesson => (
                        <div
                          key={lesson.id}
                          className="p-4 rounded-2xl bg-surface hover:bg-surface-container transition-colors border border-outline-variant/30 flex items-center gap-4"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            lesson.type === 'quiz'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}>
                            {lesson.type === 'video'
                              ? <PlayCircle className="w-5 h-5" />
                              : lesson.type === 'pdf'
                              ? <FileText className="w-5 h-5" />
                              : <ClipboardList className="w-5 h-5" />
                            }
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-bold text-on-surface text-base">{lesson.title}</h4>
                            <span className="text-sm text-on-surface-variant">
                              {lesson.type === 'video' ? 'Video' : lesson.type === 'pdf' ? 'Tài liệu' : 'Bài kiểm tra'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg flex-shrink-0">
                            {lesson.duration}
                          </div>
                        </div>
                      ))}
                    </div>
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
              </AnimatePresence>
            </div>
          </div>

          {/* Cột mua hàng (phải): sticky card — luôn hiển thị khi scroll */}
          <div className="lg:col-span-1 relative">
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[2rem] p-6 shadow-2xl shadow-primary/10 sticky top-28">
              <div className="rounded-2xl overflow-hidden mb-6 aspect-video relative group">
                <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <PlayCircle className="w-8 h-8 ml-1" />
                  </div>
                </div>
              </div>
              {/* Giá: hiển thị giá gốc + giá gạch ngang (giả lập 1.5x) */}
              <div className="text-3xl font-extrabold text-primary mb-1 text-center">{course.price}</div>
              <div className="text-center text-sm text-on-surface-variant line-through mb-6">
                {(parseInt(course.price?.replace(/\D/g, '') ?? '0') * 1.5).toLocaleString('vi-VN')}đ
              </div>
              {/* CTA: handleAddToCart() — chỉ thêm vào giỏ khi đã đăng nhập */}
              <button
                onClick={handleAddToCart}
                className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mb-4"
              >
                <ShoppingCart className="w-6 h-6" />
                Thêm vào giỏ hàng
              </button>
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
function LearningView({ course }: { course: Course }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Khởi tạo activeLesson = bài đầu tiên không phải quiz
  // (không mở quiz ngay khi vào trang — phải click mới mở modal)
  const [activeLesson, setActiveLesson] = useState<Lesson>(
    (course.lessons?.find(l => l.type !== 'quiz') ?? course.lessons?.[0]) as Lesson
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'notes'>('overview');

  // activeQuiz: null = không hiện modal, Lesson = hiện QuizModal cho bài đó
  const [activeQuiz, setActiveQuiz] = useState<Lesson | null>(null);

  // quizScores: lưu điểm quiz trong session hiện tại
  // Key = lessonId, Value = điểm % (0-100)
  // Dùng để hiển thị điểm cũ trong sidebar và truyền vào QuizModal làm prevScore
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});

  // Router điều hướng click trong sidebar
  function handleLessonClick(lesson: Lesson) {
    if (lesson.type === 'quiz') {
      // Quiz → mở modal overlay, KHÔNG thay đổi activeLesson (video/pdf giữ nguyên)
      setActiveQuiz(lesson);
    } else {
      // Video/PDF → đổi nội dung player
      setActiveLesson(lesson);
    }
  }

  // Callback từ QuizModal khi user nộp bài
  // Ghi điểm vào quizScores: { ...prev, [lessonId]: score }
  function handleQuizComplete(lessonId: string, score: number) {
    setQuizScores((prev: Record<string, number>) => ({ ...prev, [lessonId]: score }));
  }

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
        </div>
        <div className="flex items-center gap-4">
          {/* Thanh tiến độ tổng — từ course.progress (dữ liệu mock, chưa tính động) */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{course.progress}%</span>
            <div className="w-32 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${course.progress}%` }} />
            </div>
          </div>
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
        {/* lg:pr-[380px] khi sidebar mở: đẩy nội dung sang trái để không bị sidebar che */}
        <div className={`flex flex-col flex-grow transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'lg:pr-[380px]' : ''}`}>

          {/* Video / PDF player (giả lập) */}
          <div className="w-full bg-black aspect-video relative group flex-shrink-0">
            <img src={course.image} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            {activeLesson?.type === 'video' ? (
              // Video player: nút play ở giữa + thanh control khi hover
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-primary/90 text-on-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer">
                  <PlayCircle className="w-12 h-12 ml-1" />
                </div>
              </div>
            ) : (
              // PDF viewer: icon + nút tải xuống
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <FileText className="w-16 h-16 mb-4 opacity-80 text-blue-400" />
                <h3 className="text-2xl font-bold">Tài liệu PDF</h3>
                <button className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors">
                  Tải xuống
                </button>
              </div>
            )}
            {/* Controls overlay — chỉ hiện khi hover vào video */}
            {activeLesson?.type === 'video' && (
              <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden mb-3 cursor-pointer">
                  <div className="w-1/3 h-full bg-primary rounded-full relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-white text-sm font-medium">
                  <div className="flex items-center gap-4">
                    <PlayCircle className="w-5 h-5 cursor-pointer" />
                    <span>04:12 / {activeLesson?.duration}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="cursor-pointer">1x</span>
                    <span className="cursor-pointer">HD</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thông tin bài học + tabs (Overview / Q&A / Notes) */}
          <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-on-surface mb-2">{activeLesson?.title}</h2>
                <div className="text-on-surface-variant font-medium flex items-center gap-2">
                  <span>Chương 1</span> ·
                  <span className="text-primary">{activeLesson?.type === 'video' ? 'Video' : 'Tài liệu'}</span>
                </div>
              </div>
              <button
                onClick={() => notify.success('Đã đánh dấu hoàn thành!')}
                className="px-6 py-3 bg-surface-container border border-outline-variant hover:border-primary hover:text-primary rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap"
              >
                <CheckCircle2 className="w-5 h-5" /> Đánh dấu xong
              </button>
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
                  {/* layoutId="learningTabIndicator": Framer Motion chia sẻ animation giữa các tab */}
                  {activeTab === tab.id && (
                    <motion.div layoutId="learningTabIndicator" className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-[200px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-on-surface-variant leading-relaxed text-lg">
                      Nội dung chi tiết của {activeLesson?.title}. Chú ý theo dõi kỹ các ví dụ thực hành trong bài. Sau khi học xong, hãy làm bài kiểm tra cuối chương để củng cố kiến thức.
                    </p>
                  </motion.div>
                )}
                {activeTab === 'qa' && (
                  <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-10 opacity-60">
                    <MessageSquare className="w-12 h-12 mb-4 text-on-surface-variant" />
                    <p className="font-semibold text-on-surface">Chưa có câu hỏi nào.</p>
                    <button className="text-primary font-bold mt-2">Đặt câu hỏi đầu tiên</button>
                  </motion.div>
                )}
                {activeTab === 'notes' && (
                  <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <textarea
                      placeholder="Ghi chú của bạn cho bài học này..."
                      className="w-full min-h-[160px] p-4 rounded-2xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                    />
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
                {/* Nút đóng sidebar — chỉ hiện trên mobile (desktop toggle qua topbar button) */}
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-surface-container rounded-lg lg:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-3 space-y-1.5">
                {course.lessons?.map(lesson => {
                  const isActive = activeLesson?.id === lesson.id;
                  const quizScore = quizScores[lesson.id]; // undefined nếu chưa làm
                  const isQuiz = lesson.type === 'quiz';

                  // ── Quiz item trong sidebar ──────────────────────────────
                  // Hiển thị badge "Quiz" + điểm % nếu đã làm (quizScore !== undefined)
                  // Nền vàng nhạt khi đã làm, nền trắng khi chưa
                  if (isQuiz) {
                    const hasScore = quizScore !== undefined;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        className={`w-full text-left p-4 rounded-2xl flex gap-3 transition-all border group ${
                          hasScore
                            ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                            : 'bg-surface hover:bg-amber-500/5 border-transparent hover:border-amber-500/20'
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            hasScore ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20'
                          }`}>
                            <ClipboardList className="w-4.5 h-4.5" />
                          </div>
                        </div>
                        <div className="flex-grow pr-1 min-w-0">
                          <h4 className="font-semibold text-sm leading-tight text-on-surface mb-1 line-clamp-2">
                            {lesson.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            {hasScore ? (
                              <>
                                {/* Màu xanh nếu ≥70%, đỏ nếu <70% */}
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  quizScore >= 70 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                                }`}>
                                  {quizScore}%
                                </span>
                                <span className="text-xs text-on-surface-variant">Đã làm</span>
                              </>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">{lesson.duration}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 self-center">
                          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            Quiz
                          </span>
                        </div>
                      </button>
                    );
                  }

                  // ── Video/PDF item trong sidebar ─────────────────────────
                  // Highlight màu primary khi đang xem (isActive)
                  // Dấu tích xanh khi lesson.isCompleted = true
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => handleLessonClick(lesson)}
                      className={`w-full text-left p-4 rounded-2xl flex gap-3 transition-all border ${
                        isActive
                          ? 'bg-primary/10 border-primary/30 shadow-sm'
                          : 'bg-surface hover:bg-surface-container border-transparent'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {lesson.isCompleted
                          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                          : lesson.type === 'video'
                          ? <PlayCircle className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
                          : <FileText className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-on-surface-variant'}`} />
                        }
                      </div>
                      <div className="flex-grow pr-1 min-w-0">
                        <h4 className={`font-semibold text-sm leading-tight mb-1 line-clamp-2 ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                          {lesson.title}
                        </h4>
                        <span className="text-xs text-on-surface-variant">{lesson.duration}</span>
                      </div>
                    </button>
                  );
                })}

                {/* Placeholder: chương tiếp theo bị khóa */}
                <div className="p-4 rounded-2xl flex gap-3 bg-surface-container/50 border border-transparent mt-2 opacity-60">
                  <Lock className="w-5 h-5 text-on-surface-variant mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-on-surface-variant">Chương tiếp theo đang khóa</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">Hoàn thành chương hiện tại để mở khóa</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QuizModal — render bên ngoài DOM flow để overlay toàn màn hình
          AnimatePresence để animate fade in/out khi activeQuiz thay đổi */}
      <AnimatePresence>
        {activeQuiz && (
          <QuizModal
            lesson={activeQuiz}
            prevScore={quizScores[activeQuiz.id]} // truyền điểm cũ nếu đã làm trước
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
  const purchasedIds = useCourseStore((state) => state.purchasedIds);

  // ── State fetch từ API ──────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  // ── Fetch course detail mỗi khi id thay đổi ─────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    courseServiceGetDetail(id)
      .then((detail) => setCourse(adaptCourseDetail(detail)))
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
  }, [id]);

  // ── Loading state ────────────────────────────────────────────────────────
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

  // Kiểm tra quyền truy cập học - tạm thời chỉ check purchasedIds local
  // (Module 3 sẽ check enrollments thật qua /api/my-courses)
  const isEnrolled = purchasedIds.includes(course.id);

  return isEnrolled ? (
    <LearningView course={course} />
  ) : (
    <MarketingView course={{ ...course, isEnrolled }} />
  );
}
